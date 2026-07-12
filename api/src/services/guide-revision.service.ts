import type { SupabaseClient } from "@supabase/supabase-js";
import type { UpdateRevisionInput } from "@bluelearn/schemas";
import type { Database } from "../database.types";
import { ServiceError } from "../lib/service-error";
import { diffField } from "../lib/diff";

type DB = SupabaseClient<Database>;

// The full snapshot of a single revision. RLS exposes a revision once it is
// submitted, or earlier to its own author.
const REVISION_DETAIL =
  "id, guide_id, title, summary, body, change_summary, status, created_at";

// Slimmer row used by diffRevisions: adds author_id for the RevisionRef
// header and drops guide_id/status that the diff response does not surface.
const DIFF_REVISION_DETAIL =
  "id, author_id, title, summary, body, change_summary, created_at";

// Resolve a revision by id to its snapshot. 404 when RLS hides it.
export async function getRevision(supabase: DB, id: string) {
  const { data: revision, error } = await supabase
    .from("guide_revisions")
    .select(REVISION_DETAIL)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load revision", 500);
  }
  if (!revision) throw new ServiceError("Revision not found", 404);

  return { revision };
}

// Overwrite a draft revision in place. RLS permits this only on the author's own
// draft, so an out-of-reach or already-submitted revision matches zero rows.
// Blank summary/body/change_summary are stored as NULL.
export async function updateRevision(
  supabase: DB,
  id: string,
  input: UpdateRevisionInput
) {
  const patch = {
    ...input,
    ...("summary" in input && { summary: input.summary || null }),
    ...("body" in input && { body: input.body || null }),
    ...("change_summary" in input && {
      change_summary: input.change_summary || null,
    }),
  };

  const { data, error } = await supabase
    .from("guide_revisions")
    .update(patch)
    .eq("id", id)
    .select(REVISION_DETAIL);

  if (error) throw new ServiceError("Unable to update revision", 400);
  if (!data || data.length === 0) {
    throw new ServiceError("Revision not found or not an editable draft", 404);
  }
  return { revision: data[0] };
}

// Submit a draft for review: flips it to submitted, opens a review case, and
// links the two in one transaction via the submit_guide_revision RPC (RLS still
// applies). Returns the opened review case id.
export async function submitRevision(supabase: DB, id: string) {
  const { data: review_case_id, error } = await supabase.rpc(
    "submit_guide_revision",
    {
      p_revision_id: id,
    }
  );

  if (error) {
    if (error.code === "P0002") {
      throw new ServiceError(
        "Revision not found or not an editable draft",
        404
      );
    }
    throw new ServiceError("Unable to submit revision", 400);
  }

  return { review_case_id };
}

// Rendered diff between two guide revision snapshots. RLS still applies, so a
// hidden revision 404s. Each versioned text field (title/summary/body) is
// compared with strict equality; when changed, `diff` carries a unified-diff
// style string (lines starting with " " are unchanged, "-" only in `from`,
// "+" only in `to`). null === null is treated as unchanged.
export async function diffRevisions(supabase: DB, id: string, otherId: string) {
  const [fromRes, toRes] = await Promise.all([
    supabase
      .from("guide_revisions")
      .select(DIFF_REVISION_DETAIL)
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("guide_revisions")
      .select(DIFF_REVISION_DETAIL)
      .eq("id", otherId)
      .maybeSingle(),
  ]);

  if (fromRes.error) {
    console.error(fromRes.error);
    throw new ServiceError("Failed to load revision", 500);
  }
  if (toRes.error) {
    console.error(toRes.error);
    throw new ServiceError("Failed to load revision", 500);
  }
  if (!fromRes.data) throw new ServiceError("Revision not found", 404);
  if (!toRes.data) throw new ServiceError("Revision not found", 404);

  const from = fromRes.data;
  const to = toRes.data;

  return {
    from: toRevisionRef(from),
    to: toRevisionRef(to),
    fields: {
      title: diffField(from.title, to.title),
      summary: diffField(from.summary, to.summary),
      body: diffField(from.body, to.body),
    },
  };
}

// Project a revision row down to the RevisionRef shape used in diff headers.
function toRevisionRef(row: {
  id: string;
  author_id: string | null;
  created_at: string;
  change_summary: string | null;
}) {
  return {
    id: row.id,
    author_id: row.author_id,
    created_at: row.created_at,
    change_summary: row.change_summary,
  };
}
