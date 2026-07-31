import type { SupabaseClient } from "@supabase/supabase-js";
import type { DecisionReason, Pagination } from "@bluelearn/schemas";
import type { Database } from "../database.types";
import { ServiceError } from "../lib/service-error";
import { PANEL_POLICY_DEFAULTS } from "../lib/review-policy";
import { readingMinutes } from "../lib/reading";

type DB = SupabaseClient<Database>;
type ReviewOutcome = Database["public"]["Enums"]["review_outcome"];
type QueueRow = {
  id: string;
  panel_id: string;
  member_id: string | null;
  status: string;
  assigned_at: string;
  review_decisions: { decision: ReviewOutcome } | null;
  review_panels: {
    id: string;
    target_seat_count: number;
    outcome: ReviewOutcome | null;
    opened_at: string;
    closed_at: string | null;
    case_id: string;
    review_cases: {
      id: string;
      case_type: string;
      status: string;
      created_at: string;
      created_by: string | null;
      time_limit: string | null;
      updated_at: string;
    };
  };
};

type GuideLinkRow = {
  case_id: string;
  guide_revision_id: string;
  guide_revisions: { title: string | null; summary: string | null };
};

type CaseListRow = {
  id: string;
  case_type: string;
  status: string;
  created_at: string;
  created_by: string | null;
  time_limit: string | null;
  updated_at: string;
  review_panels: Array<{
    id: string;
    target_seat_count: number;
    outcome: ReviewOutcome | null;
    opened_at: string;
    closed_at: string | null;
  }>;
  guide_review_cases: {
    guide_revision_id: string;
    guide_revisions: { title: string | null; summary: string | null } | null;
  } | null;
};

type CaseDetailRow = {
  id: string;
  case_type: string;
  status: string;
  created_at: string;
  created_by: string | null;
  time_limit: string | null;
  updated_at: string;
  review_panels: Array<{
    id: string;
    target_seat_count: number;
    outcome: ReviewOutcome | null;
    opened_at: string;
    closed_at: string | null;
    panel_members: Array<{
      id: string;
      member_id: string | null;
      status: string;
      assigned_at: string;
      review_decisions: {
        id: string;
        decision: ReviewOutcome;
        notes: string | null;
        created_at: string;
        review_decision_reasons: Array<{ reason: string }> | null;
      } | null;
    }>;
  }>;
  guide_review_cases: {
    guide_revision_id: string;
    guide_revisions: {
      id: string;
      guide_id: string;
      author_id: string | null;
      title: string | null;
      summary: string | null;
      body: string | null;
      status: string;
      created_at: string;
      word_count: number;
      guide_revision_subjects: Array<{
        subjects: { id: string; name: string; status: string } | null;
      }> | null;
    } | null;
  } | null;
};

type TagsAndEdges = {
  tags: Array<{ id: string; name: string; status: string }>;
  prerequisites: Array<{ slug: string; title: string | null }>;
  todos: Array<{ id: string; title: string }>;
};

export async function getReviewQueue(
  supabase: DB,
  userId: string,
  { page, limit }: Pagination = { page: 1, limit: 20 }
) {
  const { data: raw, error } = await supabase
    .from("panel_members")
    .select(
      `id, panel_id, member_id, status, assigned_at,
       review_decisions(decision),
       review_panels!inner(
         id, target_seat_count, outcome, opened_at, closed_at, case_id,
         review_cases!inner(id, case_type, status, created_at, created_by, time_limit, updated_at)
       )`
    )
    .eq("member_id", userId)
    .in("status", ["assigned", "completed"]);

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load review queue", 500);
  }

  const memberships = (raw ?? []) as unknown as QueueRow[];

  const open = memberships.filter(
    (m) =>
      m.review_panels.review_cases.status === "pending" ||
      m.review_panels.review_cases.status === "in_review"
  );

  const caseIds = [
    ...new Set(open.map((m) => m.review_panels.review_cases.id)),
  ];

  let guideLinks: GuideLinkRow[] = [];
  if (caseIds.length > 0) {
    const { data: links, error: linkError } = await supabase
      .from("guide_review_cases")
      .select(
        "case_id, guide_revision_id, guide_revisions!inner(title, summary)"
      )
      .in("case_id", caseIds);

    if (linkError) {
      console.error(linkError);
      throw new ServiceError("Failed to load guide revision details", 500);
    }
    guideLinks = (links ?? []) as unknown as GuideLinkRow[];
  }

  const all = open
    .map((m) => {
      const rc = m.review_panels.review_cases;
      const link = guideLinks.find((l) => l.case_id === rc.id);
      return {
        id: rc.id,
        case_type: rc.case_type,
        status: rc.status,
        title: link?.guide_revisions?.title ?? null,
        created_at: rc.created_at,
        decision: m.review_decisions?.decision ?? null,
      };
    })
    .sort(
      (a, b) =>
        // cases still needing a vote first, then newest
        Number(a.decision !== null) - Number(b.decision !== null) ||
        b.created_at.localeCompare(a.created_at)
    );

  const from = (page - 1) * limit;
  const to = from + limit;
  return { data: all.slice(from, to), total: all.length };
}

export async function listReviewCases(supabase: DB) {
  const { data: raw, error } = await supabase
    .from("review_cases")
    .select(
      `id, case_type, status, created_at, created_by, time_limit, updated_at,
       review_panels(id, target_seat_count, outcome, opened_at, closed_at),
       guide_review_cases(
         guide_revision_id,
         guide_revisions(title, summary)
       )`
    )
    .in("status", ["approved", "rejected"])
    .order("updated_at", { ascending: false });

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to list review cases", 500);
  }

  const rows = (raw ?? []) as unknown as CaseListRow[];

  return rows.map((c) => ({
    id: c.id,
    case_type: c.case_type,
    status: c.status,
    title: c.guide_review_cases?.guide_revisions?.title ?? null,
    created_at: c.created_at,
  }));
}

// The tags and edges a revision proposes. Uses service client because
// draft tags and edges are unreachable through RLS.
async function loadTagsAndEdges(
  service: DB,
  revisionId: string,
  guideId: string
): Promise<TagsAndEdges> {
  const { data: guide, error: guideError } = await service
    .from("guides")
    .select("guide_base_id")
    .eq("id", guideId)
    .maybeSingle();

  if (guideError) {
    console.error(guideError);
    throw new ServiceError("Failed to load revision tags and edges", 500);
  }

  const baseId = guide?.guide_base_id ?? null;

  const [tagRes, edgeRes, todoRes] = await Promise.all([
    service
      .from("guide_revision_subjects")
      .select("subjects(id, name, status)")
      .eq("guide_revision_id", revisionId),
    baseId
      ? service
          .from("guide_edges")
          .select(
            `from:guide_bases!from_guide_base_id(
               slug,
               canonical:guides!guide_bases_canonical_guide_id_fkey(
                 current:guide_revisions!guides_current_revision_id_fkey(title)
               )
             )`
          )
          .eq("to_guide_base_id", baseId)
          .eq("edge_type", "prerequisite")
      : { data: [], error: null },
    baseId
      ? service
          .from("todo_prerequisites")
          .select("id, title")
          .eq("dependent_guide_base_id", baseId)
          .eq("status", "open")
      : { data: [], error: null },
  ]);

  if (tagRes.error || edgeRes.error || todoRes.error) {
    console.error(tagRes.error ?? edgeRes.error ?? todoRes.error);
    throw new ServiceError("Failed to load revision tags and edges", 500);
  }

  return {
    tags: (tagRes.data ?? [])
      .map((r) => r.subjects)
      .filter((s): s is NonNullable<typeof s> => !!s)
      .map((s) => ({ id: s.id, name: s.name, status: s.status })),
    prerequisites: (edgeRes.data ?? [])
      .map((e) => e.from)
      .filter((b): b is NonNullable<typeof b> & { slug: string } => !!b?.slug)
      .map((b) => ({
        slug: b.slug,
        title: b.canonical?.current?.title ?? null,
      })),
    todos: (todoRes.data ?? []).map((t) => ({ id: t.id, title: t.title })),
  };
}

export async function getReviewCase(
  supabase: DB,
  service: DB,
  caseId: string,
  viewerId: string | null
) {
  const { data: raw, error } = await supabase
    .from("review_cases")
    .select(
      `id, case_type, status, created_at, created_by, time_limit, updated_at,
       review_panels(
         id, target_seat_count, outcome, opened_at, closed_at,
         panel_members(
           id, member_id, status, assigned_at,
           review_decisions(
             id, decision, notes, created_at,
             review_decision_reasons(reason)
           )
         )
       ),
       guide_review_cases(
         guide_revision_id,
         guide_revisions(
           id, guide_id, author_id, title, summary, body, status, created_at, word_count,
           guide_revision_subjects(subjects(id, name, status))
         )
       )`
    )
    .eq("id", caseId)
    .order("opened_at", { foreignTable: "review_panels", ascending: false })
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load review case", 500);
  }
  if (!raw) throw new ServiceError("Review case not found", 404);

  const data = raw as unknown as CaseDetailRow;
  const revision = data.guide_review_cases?.guide_revisions ?? null;
  const latestPanel = data.review_panels[0] ?? null;
  const members = latestPanel?.panel_members ?? [];

  const mapDecision = (
    d: NonNullable<
      CaseDetailRow["review_panels"][number]["panel_members"][number]["review_decisions"]
    >
  ) => ({
    id: d.id,
    decision: d.decision,
    notes: d.notes,
    reasons: d.review_decision_reasons?.map((r) => r.reason) ?? [],
    created_at: d.created_at,
  });

  // Lets the reviewer come back to a review decision with their own data reseeded
  // (vote, note, and reason).
  const viewerVote =
    viewerId === null
      ? null
      : (members.find((pm) => pm.member_id === viewerId)?.review_decisions ??
        null);

  const closed = data.status === "approved" || data.status === "rejected";
  const isAuthor = viewerId !== null && revision?.author_id === viewerId;
  const isPanelist =
    viewerId !== null &&
    data.review_panels.some((p) =>
      p.panel_members.some((pm) => pm.member_id === viewerId)
    );
  const viewerRole = isPanelist ? "panelist" : isAuthor ? "author" : "public";

  // An open case can only be seen by its author and its panel members.
  if (viewerRole === "public" && !closed)
    throw new ServiceError("You cannot view this review case", 403);

  // Tags and edges are made public on closed cases, but while the case is open,
  // only the author and the seats can see them.
  const canSeeTagsAndEdges = closed || isAuthor || isPanelist;

  const tagsAndEdges =
    canSeeTagsAndEdges && revision
      ? await loadTagsAndEdges(service, revision.id, revision.guide_id)
      : null;

  return {
    case: {
      id: data.id,
      case_type: data.case_type,
      status: data.status,
      title: data.guide_review_cases?.guide_revisions?.title ?? null,
      created_by: data.created_by,
      created_at: data.created_at,
      updated_at: data.updated_at,
    },
    panel: members.map((pm) => ({
      id: pm.id,
      member_id: pm.member_id,
      status: pm.status,
      assigned_at: pm.assigned_at,
    })),
    decisions: members
      .filter((pm) => pm.review_decisions)
      .map((pm) => mapDecision(pm.review_decisions!)),
    viewer_decision: viewerVote ? mapDecision(viewerVote) : null,
    viewer_role: viewerRole,
    revision: revision
      ? {
          id: revision.id,
          title: revision.title,
          summary: revision.summary,
          body: revision.body,
          status: revision.status,
          created_at: revision.created_at,
          duration_minutes: readingMinutes(revision.word_count),
          tags:
            tagsAndEdges?.tags ??
            (revision.guide_revision_subjects ?? [])
              .map((r) => r.subjects)
              .filter((s): s is NonNullable<typeof s> => !!s),
        }
      : null,
    prerequisites: tagsAndEdges?.prerequisites ?? [],
    todos: tagsAndEdges?.todos ?? [],
  };
}

export async function castDecision(
  supabase: DB,
  caseId: string,
  input: {
    decision: ReviewOutcome;
    notes?: string | null;
    reasons?: DecisionReason[];
  }
) {
  // Write the decision, its rubric reasons, and the seat completion in one
  // transaction.
  const { data, error } = await supabase.rpc("cast_review_decision", {
    p_case_id: caseId,
    p_decision: input.decision,
    p_notes: input.notes ?? undefined,
    p_reasons: input.decision === "rejected" ? (input.reasons ?? []) : [],
  });

  if (error) {
    if (error.code === "22023")
      throw new ServiceError("No active review panel for this case", 400);
    if (error.code === "42501")
      throw new ServiceError(
        "You are not an active panelist on this case",
        403
      );
    console.error(error);
    throw new ServiceError("Failed to record decision", 500);
  }

  // This cast may be the deciding vote. close_review_panel tallies, no-ops until
  // one outcome holds a majority, and on approval, publishes the revision.
  const { error: closeError } = await supabase.rpc("close_review_panel", {
    p_case_id: caseId,
  });

  if (closeError) {
    console.error(closeError);
    throw new ServiceError("Failed to record decision", 500);
  }

  return data as {
    id: string;
    decision: ReviewOutcome;
    notes: string | null;
    reasons: DecisionReason[];
    created_at: string;
  };
}

// Seat a panel on every case still waiting for one (used by cron trigger).
export async function assemblePendingPanels(supabase: DB) {
  const { data: cases, error } = await supabase
    .from("review_cases")
    .select("id, case_type")
    .eq("status", "pending");

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load pending review cases", 500);
  }

  for (const c of cases ?? []) {
    const { error: rpcError } = await supabase.rpc("assemble_review_panel", {
      p_case_id: c.id,
      p_policy_default: PANEL_POLICY_DEFAULTS[c.case_type],
    });
    // One case failing to seat must not stall the rest of the batch.
    if (rpcError) console.error(rpcError);
  }
}
