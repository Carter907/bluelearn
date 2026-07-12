import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateObjectiveInput } from "@bluelearn/schemas";
import type { Database } from "../database.types";
import { ServiceError } from "../lib/service-error";
import { getRevisionSnapshot } from "./objective-revision.service";

type DB = SupabaseClient<Database>;

// This embed walks objectives -> current revision through the live pointer FK.
const CURRENT_META = `
  current:objective_revisions!objectives_current_revision_id_fkey(
    title,
    summary
  )
`;

// Resolve a objective slug to its id + live revision, or 404. RLS hides drafts, so an
// unseen objective reads as missing. A published objective always carries a slug and a
// current_revision_id, so this only resolves live objectives.
async function resolveObjective(supabase: DB, rawSlug: string) {
  const { data, error } = await supabase
    .from("objectives")
    .select("id, current_revision_id")
    .eq("slug", rawSlug.toLowerCase())
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load objective", 500);
  }
  if (!data) throw new ServiceError("Objective not found", 404);
  return data;
}

// List published objectives, newest first. RLS hides drafts from non-authors.
export async function listPublishedObjectives(supabase: DB) {
  const { data, error } = await supabase
    .from("objectives")
    .select(`id, slug, created_at, ${CURRENT_META}`)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load objectives", 500);
  }

  return (data ?? []).map(({ current, ...objective }) => ({
    ...objective,
    title: current?.title ?? null,
    summary: current?.summary ?? null,
  }));
}

// Create a objective: bundles the objective shell + revision 1 + the targets' prerequisite
// closure as the initial node set in one transaction via the create_objective
// RPC (RLS still applies, SECURITY INVOKER). Returns the draft revision id so the
// client routes straight to its editor.
export async function createObjective(
  supabase: DB,
  input: CreateObjectiveInput
) {
  const { data: revision_id, error } = await supabase.rpc("create_objective", {
    p_targets: input.target_ids,
    p_title: input.title ?? undefined,
    p_summary: input.summary ?? undefined,
  });

  if (error) {
    // RLS restricts objective creation to curators; a denied insert surfaces as 42501.
    if (error.code === "42501")
      throw new ServiceError("Not permitted to create a objective", 403);
    console.error(error);
    throw new ServiceError("Failed to create objective", 500);
  }
  return { revision_id };
}

// Resolve a objective by slug. Includes every node (included or skipped) and both the
// frozen projected edges and the live raw edges. Same { metadata, snapshot } shape
// the revision endpoint returns, keyed on the objective instead of a revision.
export async function getObjectiveBySlug(supabase: DB, rawSlug: string) {
  const slug = rawSlug.toLowerCase();

  const { data: row, error } = await supabase
    .from("objectives")
    .select(`id, slug, status, current_revision_id, ${CURRENT_META}`)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load objective", 500);
  }
  if (!row || !row.current_revision_id)
    throw new ServiceError("Objective not found", 404);

  const { current, ...base } = row;
  const objective = {
    ...base,
    title: current?.title ?? null,
    summary: current?.summary ?? null,
  };

  const snapshot = await getRevisionSnapshot(supabase, row.current_revision_id);
  return { objective, snapshot };
}

// Archive the objective. Per RLS this is curator(owner)/moderator-only; a non-permitted
// caller simply matches zero rows and reads as not found.
export async function archiveObjective(supabase: DB, rawSlug: string) {
  const { data, error } = await supabase
    .from("objectives")
    .update({ status: "archived" })
    .eq("slug", rawSlug.toLowerCase())
    .select("id, slug, status");

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to archive objective", 500);
  }
  if (!data || data.length === 0) {
    throw new ServiceError("Objective not found or not permitted", 404);
  }
  return data[0];
}

// The objective's revision history, newest first. Drafts (null published_at) sort by
// creation alongside published ones.
export async function listObjectiveRevisions(supabase: DB, rawSlug: string) {
  const { id } = await resolveObjective(supabase, rawSlug);

  const { data, error } = await supabase
    .from("objective_revisions")
    .select("id, title, change_summary, status, created_at, published_at")
    .eq("objective_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load revisions", 500);
  }
  return data ?? [];
}
