import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateGuideInput,
  CreateVariantInput,
  Guide,
  GuideListItem,
  Pagination,
  SubjectReference,
  Walkthrough,
} from "@bluelearn/schemas";
import type { Database } from "../database.types";
import { ServiceError } from "../lib/service-error";
import { selectInBatches } from "../lib/batch";
import { syncDraftTagsAndEdges } from "./guide-revision.service";
import { readingMinutes } from "../lib/reading";
import { loadUsernames } from "./identity.service";

type DB = SupabaseClient<Database>;

// Names the exact published_guides columns that PUBLISHED_GUIDE_SELECT fetches.
type GuideCardRow = Pick<
  Database["public"]["Views"]["published_guides"]["Row"],
  | "id"
  | "base_slug"
  | "title"
  | "knowledge_type"
  | "status"
  | "created_at"
  | "author_id"
  | "revision_id"
  | "summary"
  | "word_count"
>;

// Columns of published_guides a card needs.
export const PUBLISHED_GUIDE_SELECT =
  `id, base_slug, title, knowledge_type, status, created_at,
   author_id, revision_id, summary, word_count` as const;

type WalkthroughRPC = {
  nodes: (Omit<Walkthrough["nodes"][number], "duration_minutes"> & {
    word_count: number;
  })[];
  edges: Walkthrough["edges"];
};

// A guide's title/summary/body live on the canonical guide's current
// revision, not on the base. This embed walks guide_bases -> canonical
// guide -> its live revision.
const CANONICAL_CONTENT = `
  canonical:guides!guide_bases_canonical_guide_id_fkey(
    id,
    slug,
    author_id,
    current:guide_revisions!guides_current_revision_id_fkey(
      id,
      title,
      summary,
      body,
      word_count,
      created_at
    )
  )
`;

// Get a guide base's tags, which live on its canonical variant's current
// revision.
async function loadCanonicalTags(supabase: DB, revisionId: string | null) {
  if (!revisionId) return [];

  const { data, error } = await supabase
    .from("guide_revision_subjects")
    .select("subjects(id, slug, name)")
    .eq("guide_revision_id", revisionId);

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load guide subjects", 500);
  }
  return (data ?? [])
    .map((r) => r.subjects)
    .filter((s): s is NonNullable<typeof s> & { slug: string } => !!s?.slug);
}

// Resolve a base slug to its id, or 404. Shared by the variant/walkthrough
// reads that key off a base. RLS hides drafts, so an unseen base reads as
// missing.
async function resolveBaseId(supabase: DB, rawSlug: string) {
  const { data, error } = await supabase
    .from("guide_bases")
    .select("id")
    .eq("slug", rawSlug.toLowerCase())
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load guide", 500);
  }
  if (!data) throw new ServiceError("Guide not found", 404);
  return data.id;
}

// Subjects carried by each guide revision. Used to show the
// guide's full tag set even when the list itself was
// filtered to one subject.
async function loadGuideTags(supabase: DB, revisionIds: string[]) {
  const map = new Map<string, SubjectReference[]>();
  if (revisionIds.length === 0) return map;

  const { data, error } = await selectInBatches(revisionIds, (batch) =>
    supabase
      .from("guide_revision_subjects")
      .select("guide_revision_id, subject:subjects(slug, name)")
      .in("guide_revision_id", batch)
  );

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load guide tags", 500);
  }
  for (const row of data ?? []) {
    const subject = row.subject;
    if (!subject?.slug) continue;
    const list = map.get(row.guide_revision_id) ?? [];
    list.push({ slug: subject.slug, name: subject.name });
    map.set(row.guide_revision_id, list);
  }
  for (const list of map.values())
    list.sort((a, b) => a.name.localeCompare(b.name));
  return map;
}

// Assemble card list items from guide_bases rows.
export async function buildGuideListItems(
  supabase: DB,
  rows: GuideCardRow[]
): Promise<GuideListItem[]> {
  const [tagsByRevision, usernames] = await Promise.all([
    loadGuideTags(
      supabase,
      rows.map((r) => r.revision_id!)
    ),
    loadUsernames(
      supabase,
      rows.map((r) => r.author_id)
    ),
  ]);

  return rows.map((card) => ({
    id: card.id!,
    slug: card.base_slug,
    title: card.title,
    knowledge_type: card.knowledge_type!,
    summary: card.summary,
    status: card.status!,
    created_at: card.created_at!,
    author: card.author_id ? (usernames.get(card.author_id) ?? null) : null,
    duration_minutes: readingMinutes(card.word_count ?? 0),
    tags: tagsByRevision.get(card.revision_id!) ?? [],
  }));
}

// List published guides as cards, alphabetical by title.
export async function listPublishedGuides(
  supabase: DB,
  { page, limit }: Pagination = { page: 1, limit: 20 }
): Promise<{ data: GuideListItem[]; total: number }> {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, count, error } = await supabase
    .from("published_guides")
    .select(PUBLISHED_GUIDE_SELECT, { count: "exact" })
    .order("title")
    .range(from, to);

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load guides", 500);
  }

  return {
    data: await buildGuideListItems(supabase, data ?? []),
    total: count ?? 0,
  };
}

// Create a guide: the create_guide RPC bundles the guide_base + first guide +
// draft revision, then we attach its tags and edges. Returns the draft revision
// id so the client can keep editing or submit it.
export async function createGuide(
  supabase: DB,
  userId: string,
  input: CreateGuideInput
) {
  const {
    title,
    knowledge_type,
    summary,
    body,
    tags,
    prerequisites,
    newSubjects,
    todoPrereqs,
  } = input;

  const { data: revision_id, error } = await supabase.rpc("create_guide", {
    p_title: title ?? undefined,
    p_knowledge_type: knowledge_type,
    p_summary: summary ?? undefined,
    p_body: body ?? undefined,
  });

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to create guide", 500);
  }

  await syncDraftTagsAndEdges(supabase, userId, revision_id, {
    tags,
    prerequisites,
    newSubjects,
    todoPrereqs,
  });

  return { revision_id };
}

// Resolve a guide by slug to its canonical content + subject tags. The prereq/
// dependent neighborhood is deferred to the graph pass.
export async function getGuideBySlug(supabase: DB, rawSlug: string) {
  const slug = rawSlug.toLowerCase();

  const { data: guide, error } = await supabase
    .from("guide_bases")
    .select(
      `id, slug, knowledge_type, status, created_at, updated_at, ${CANONICAL_CONTENT}`
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load guide", 500);
  }
  if (!guide) throw new ServiceError("Guide not found", 404);

  const current = guide.canonical?.current ?? null;
  const subjects = await loadCanonicalTags(supabase, current?.id ?? null);
  const authorId = guide.canonical?.author_id ?? null;
  const usernames = await loadUsernames(supabase, [authorId]);

  const detail: Guide = {
    slug: guide.slug ?? "",
    variant_slug: guide.canonical?.slug ?? null,
    title: current?.title ?? "",
    author: authorId ? (usernames.get(authorId) ?? "") : "",
    summary: current?.summary ?? null,
    body: current?.body ?? null,
    duration_minutes: readingMinutes(current?.word_count ?? 0),
    created_at: guide.created_at,
    tags: subjects.map((s) => ({ slug: s.slug, name: s.name })),
    prerequisites: [],
  };

  return detail;
}

// Archive the guide. Per RLS this is moderator/admin-only (authors cannot move
// a guide off 'draft'); a non-permitted caller simply matches zero rows.
export async function archiveGuide(supabase: DB, rawSlug: string) {
  const slug = rawSlug.toLowerCase();

  const { data, error } = await supabase
    .from("guide_bases")
    .update({ status: "archived" })
    .eq("slug", slug)
    .select("id, slug, status");

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to archive guide", 500);
  }
  if (!data || data.length === 0) {
    throw new ServiceError("Guide not found or not permitted", 404);
  }
  return data[0];
}

// Build the target's transitive prerequisite DAG (nodes + edges, RLS-filtered)
// via the compute_walkthrough RPC.
export async function getWalkthrough(supabase: DB, rawSlug: string) {
  const baseId = await resolveBaseId(supabase, rawSlug);

  const { data, error } = await supabase.rpc("compute_walkthrough", {
    p_guide_base_id: baseId,
  });

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to compute walkthrough", 500);
  }

  const { nodes, edges } = data as unknown as WalkthroughRPC;
  return {
    nodes: nodes.map(({ word_count, ...node }) => ({
      ...node,
      duration_minutes: readingMinutes(word_count),
    })),
    edges,
  } satisfies Walkthrough;
}

// List the published variants (methods/alternatives) under a guide, ranked
// by Wilson score lower bound
export async function listGuideVariants(
  supabase: DB,
  rawSlug: string,
  { page, limit }: Pagination = { page: 1, limit: 20 }
) {
  const baseId = await resolveBaseId(supabase, rawSlug);

  const { data, error } = await supabase.rpc("list_guide_variants_by_score", {
    p_guide_base_id: baseId,
  });

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load variants", 500);
  }

  const all = data ?? [];
  const from = (page - 1) * limit;
  const to = from + limit;
  return {
    data: all.slice(from, to),
    total: all.length,
  };
}

// Add a variant under a guide: a draft guide + first revision via the
// create_variant RPC. Returns the draft revision id so the client routes to its
// editor.
export async function addGuideVariant(
  supabase: DB,
  userId: string,
  rawSlug: string,
  input: CreateVariantInput
) {
  const baseId = await resolveBaseId(supabase, rawSlug);

  const { data: revision_id, error } = await supabase.rpc("create_variant", {
    p_guide_base_id: baseId,
    p_title: input.title ?? undefined,
    p_summary: input.summary ?? undefined,
    p_body: input.body ?? undefined,
  });

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to add variant", 500);
  }

  // Prereqs and todos aren't include because those are inherited from shared base.
  await syncDraftTagsAndEdges(supabase, userId, revision_id, {
    tags: input.tags,
    newSubjects: input.newSubjects,
  });

  return { revision_id };
}

// Resolve a base + variant slug pair to the variant's content and public vote
// tally. Drafts carry no slug, so this only ever resolves published variants.
export async function getVariantBySlug(
  supabase: DB,
  rawSlug: string,
  rawVariantSlug: string
) {
  const baseId = await resolveBaseId(supabase, rawSlug);

  const { data: variant, error } = await supabase
    .from("guides")
    .select(
      `id, guide_base_id, slug, status,
       current:guide_revisions!guides_current_revision_id_fkey(id, title, summary, body, created_at)`
    )
    .eq("guide_base_id", baseId)
    .eq("slug", rawVariantSlug.toLowerCase())
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load variant", 500);
  }
  if (!variant) throw new ServiceError("Variant not found", 404);

  const { data: tally, error: tallyError } = await supabase
    .from("guide_vote_tallies")
    .select("upvotes, downvotes")
    .eq("guide_id", variant.id)
    .maybeSingle();

  if (tallyError) {
    console.error(tallyError);
    throw new ServiceError("Failed to load vote tally", 500);
  }

  return {
    variant: {
      ...variant,
      votes: { up: tally?.upvotes ?? 0, down: tally?.downvotes ?? 0 },
    },
  };
}
