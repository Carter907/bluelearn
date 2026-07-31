import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ObjectiveTargetInput,
  UpdateObjectiveNodeInput,
  UpdateObjectiveRevisionInput,
} from "@bluelearn/schemas";
import type { Database } from "../database.types";
import { ServiceError } from "../lib/service-error";
import { selectInBatches } from "../lib/batch";
import { diffField } from "../lib/diff";

type DB = SupabaseClient<Database>;

const REVISION_META =
  "id, title, summary, change_summary, status, created_at, published_at, updated_at";

const NODE_COLS =
  "id, guide_base_id, guide_id, is_target, is_included, is_featured, target_position, note";

// Adds author_id for the diff's RevisionRef header and keeps status so we know
// whether to load edges frozen (published) or live (draft). Drops
// published_at/updated_at which the diff response does not surface.
const DIFF_REVISION_META =
  "id, author_id, title, summary, change_summary, status, created_at";

// All of a revision's nodes (included or skipped), the curator's linear order
// under each target, plus the projected edges (the bridged projection over
// included nodes) and the raw prerequisite edges among every node, read live
// from the guide graph.
export async function getRevisionSnapshot(
  supabase: DB,
  revisionId: string,
  projectedSource: "frozen" | "live" = "frozen"
) {
  const { data: nodeRows, error: nodeError } = await supabase
    .from("objective_revision_nodes")
    .select(NODE_COLS)
    .eq("revision_id", revisionId);

  if (nodeError) {
    console.error(nodeError);
    throw new ServiceError("Failed to load revision", 500);
  }

  const baseIds = (nodeRows ?? []).map((n) => n.guide_base_id);
  const baseMeta = new Map<
    string,
    { slug: string | null; title: string | null }
  >();

  if (baseIds.length > 0) {
    const { data: bases, error: baseError } = await supabase
      .from("guide_bases")
      .select(
        `id, slug,
         canonical:guides!guide_bases_canonical_guide_id_fkey(
           current:guide_revisions!guides_current_revision_id_fkey(title)
         )`
      )
      .in("id", baseIds);

    if (baseError) {
      console.error(baseError);
      throw new ServiceError("Failed to load revision", 500);
    }
    for (const b of bases ?? [])
      baseMeta.set(b.id, {
        slug: b.slug,
        title: b.canonical?.current?.title ?? null,
      });
  }

  const nodes = (nodeRows ?? []).map((n) => ({
    id: n.id,
    guide_base_id: n.guide_base_id,
    guide_id: n.guide_id,
    slug: baseMeta.get(n.guide_base_id)?.slug ?? null,
    title: baseMeta.get(n.guide_base_id)?.title ?? null,
    is_target: n.is_target,
    is_included: n.is_included,
    is_featured: n.is_featured,
    target_position: n.target_position,
    note: n.note,
  }));

  const { data: orderRows, error: orderError } = await supabase
    .from("objective_revision_node_orders")
    .select("target_node_id, node_id, position")
    .eq("revision_id", revisionId)
    .order("position");

  if (orderError) {
    console.error(orderError);
    throw new ServiceError("Failed to load revision order", 500);
  }

  const projectedQuery =
    projectedSource === "live"
      ? supabase.rpc("project_objective_edges", { p_revision_id: revisionId })
      : supabase
          .from("objective_revision_edges")
          .select("from_guide_base_id, to_guide_base_id")
          .eq("revision_id", revisionId);

  const [projected, raw] = await Promise.all([
    projectedQuery,
    baseIds.length > 0
      ? supabase
          .from("guide_edges")
          .select("from_guide_base_id, to_guide_base_id")
          .eq("edge_type", "prerequisite")
          .eq("is_suspended", false)
          .in("from_guide_base_id", baseIds)
          .in("to_guide_base_id", baseIds)
      : null,
  ]);

  if (projected.error) {
    console.error(projected.error);
    throw new ServiceError("Failed to load revision edges", 500);
  }
  if (raw?.error) {
    console.error(raw.error);
    throw new ServiceError("Failed to load revision edges", 500);
  }

  const toEdge = (e: {
    from_guide_base_id: string;
    to_guide_base_id: string;
  }) => ({
    from_id: e.from_guide_base_id,
    to_id: e.to_guide_base_id,
  });

  const projected_edges = (projected.data ?? []).map(toEdge);
  const raw_edges = (raw?.data ?? []).map(toEdge);

  return { nodes, orders: orderRows ?? [], projected_edges, raw_edges };
}

async function loadRevisionTags(supabase: DB, revisionId: string) {
  const { data, error } = await supabase
    .from("objective_revision_subjects")
    .select("subject:subjects(id, slug, name, summary, status)")
    .eq("objective_revision_id", revisionId);

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load revision subjects", 500);
  }
  return (data ?? []).map((r) => r.subject).filter((s) => s !== null);
}

// Replace a draft revision's subject tag set. Tags are keyed by subject id, not
// slug, because a subject proposed inline has no slug until it is approved.
export async function replaceRevisionTags(
  supabase: DB,
  revisionId: string,
  ids: string[]
) {
  const subjectIds = [...new Set(ids)];

  if (subjectIds.length > 0) {
    const { data, error } = await supabase
      .from("subjects")
      .select("id")
      .in("id", subjectIds);

    if (error) {
      console.error(error);
      throw new ServiceError("Failed to resolve subjects", 500);
    }
    if ((data ?? []).length !== subjectIds.length) {
      throw new ServiceError("Unknown subject tag", 400);
    }
  }

  const { error: delError } = await supabase
    .from("objective_revision_subjects")
    .delete()
    .eq("objective_revision_id", revisionId);

  if (delError) {
    console.error(delError);
    throw new ServiceError("Unable to update revision subjects", 400);
  }

  if (subjectIds.length > 0) {
    const { error: insError } = await supabase
      .from("objective_revision_subjects")
      .insert(
        subjectIds.map((subject_id) => ({
          objective_revision_id: revisionId,
          subject_id,
        }))
      );

    if (insError) {
      console.error(insError);
      throw new ServiceError("Unable to update revision subjects", 400);
    }
  }
}

export async function getObjectiveRevision(supabase: DB, revisionId: string) {
  const { data: revision, error } = await supabase
    .from("objective_revisions")
    .select(REVISION_META)
    .eq("id", revisionId)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to load revision", 500);
  }
  if (!revision) throw new ServiceError("Revision not found", 404);

  const snapshot = await getRevisionSnapshot(
    supabase,
    revisionId,
    revision.status === "published" ? "frozen" : "live"
  );
  const subjects = await loadRevisionTags(supabase, revisionId);
  return { revision, snapshot, subjects };
}

// Overwrite a draft revision's metadata and/or subject tags.
export async function updateObjectiveRevision(
  supabase: DB,
  userId: string,
  revisionId: string,
  input: UpdateObjectiveRevisionInput
) {
  const { tags, targets, ...fields } = input;

  // Blank summary/change_summary are stored as NULL so a cleared field reads as
  // absent, matching the guide revision path.
  const patch = {
    ...fields,
    ...("summary" in fields && { summary: fields.summary || null }),
    ...("change_summary" in fields && {
      change_summary: fields.change_summary || null,
    }),
  };

  // Check if metadata changes are present.
  let revision;
  if (Object.keys(patch).length > 0) {
    const { data, error } = await supabase
      .from("objective_revisions")
      .update(patch)
      .eq("id", revisionId)
      .select(REVISION_META);

    if (error) throw new ServiceError("Unable to update revision", 400);
    if (!data || data.length === 0) {
      throw new ServiceError(
        "Revision not found or not an editable draft",
        404
      );
    }
    revision = data[0];
  } else {
    const { data, error } = await supabase
      .from("objective_revisions")
      .select(REVISION_META)
      .eq("id", revisionId)
      .eq("status", "draft")
      .maybeSingle();

    if (error) {
      console.error(error);
      throw new ServiceError("Unable to update revision", 400);
    }
    if (!data) {
      throw new ServiceError(
        "Revision not found or not an editable draft",
        404
      );
    }
    revision = data;
  }

  if (tags !== undefined) {
    await replaceRevisionTags(supabase, revisionId, tags);
  }
  if (targets !== undefined) {
    await syncDraftCuration(supabase, userId, revisionId, targets);
  }

  const subjects = await loadRevisionTags(supabase, revisionId);
  return { revision, subjects };
}

// Edit one node of a draft revision: swap the pinned variant, toggle target/skip,
// or set a note.
export async function updateObjectiveNode(
  supabase: DB,
  revisionId: string,
  baseId: string,
  input: UpdateObjectiveNodeInput
) {
  const { data, error } = await supabase
    .from("objective_revision_nodes")
    .update(input)
    .eq("revision_id", revisionId)
    .eq("guide_base_id", baseId)
    .select(NODE_COLS);

  if (error) throw new ServiceError("Unable to update node", 400);
  if (!data || data.length === 0) {
    throw new ServiceError("Node not found or not editable", 404);
  }
  const node = data[0];

  const { data: base, error: baseError } = await supabase
    .from("guide_bases")
    .select(
      `slug,
       canonical:guides!guide_bases_canonical_guide_id_fkey(
         current:guide_revisions!guides_current_revision_id_fkey(title)
       )`
    )
    .eq("id", node.guide_base_id)
    .maybeSingle();

  if (baseError) {
    console.error(baseError);
    throw new ServiceError("Failed to load guide", 500);
  }

  return {
    node: {
      id: node.id,
      guide_base_id: node.guide_base_id,
      guide_id: node.guide_id,
      slug: base?.slug ?? null,
      title: base?.canonical?.current?.title ?? null,
      is_target: node.is_target,
      is_included: node.is_included,
      is_featured: node.is_featured,
      target_position: node.target_position,
      note: node.note,
    },
  };
}

async function loadClosure(supabase: DB, targetIds: string[]) {
  const { data, error } = await supabase.rpc("objective_closure", {
    p_targets: targetIds,
  });

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to resolve prerequisites", 500);
  }
  return (data ?? []).map((r) => r.guide_base_id);
}

async function requireCurator(supabase: DB, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "curator");

  if (error) {
    console.error(error);
    throw new ServiceError("Failed to verify permissions", 500);
  }
  if ((data ?? []).length === 0) {
    throw new ServiceError("Only curators can curate objectives", 403);
  }
}

export async function syncDraftCuration(
  supabase: DB,
  userId: string,
  revisionId: string,
  targets: ObjectiveTargetInput[]
) {
  await requireCurator(supabase, userId);

  const targetIds = targets.map((t) => t.guide_base_id);
  if (new Set(targetIds).size !== targetIds.length) {
    throw new ServiceError("Targets must be distinct", 400);
  }

  const closure = await loadClosure(supabase, targetIds);
  const closureSet = new Set(closure);

  const { error: clearError } = await supabase
    .from("objective_revision_nodes")
    .update({ is_target: false, target_position: null, is_featured: false })
    .eq("revision_id", revisionId);

  if (clearError) {
    console.error(clearError);
    throw new ServiceError("Unable to update targets", 400);
  }

  const { data: existing, error: existingError } = await supabase
    .from("objective_revision_nodes")
    .select("guide_base_id")
    .eq("revision_id", revisionId);

  if (existingError) {
    console.error(existingError);
    throw new ServiceError("Failed to load revision nodes", 500);
  }

  const stale = (existing ?? [])
    .map((n) => n.guide_base_id)
    .filter((id) => !closureSet.has(id));

  if (stale.length > 0) {
    const { error } = await selectInBatches(stale, (batch) =>
      supabase
        .from("objective_revision_nodes")
        .delete()
        .eq("revision_id", revisionId)
        .in("guide_base_id", batch)
    );
    if (error) {
      console.error(error);
      throw new ServiceError("Unable to update targets", 400);
    }
  }

  const { data: bases, error: basesError } = await selectInBatches(
    closure,
    (batch) =>
      supabase
        .from("guide_bases")
        .select("id, canonical_guide_id")
        .in("id", batch)
  );

  if (basesError) {
    console.error(basesError);
    throw new ServiceError("Failed to load guides", 500);
  }

  const canonicalByBase = new Map(
    (bases ?? [])
      .filter((b) => b.canonical_guide_id !== null)
      .map((b) => [b.id, b.canonical_guide_id as string])
  );

  const missingTarget = targetIds.find((id) => !canonicalByBase.has(id));
  if (missingTarget) {
    throw new ServiceError("Target guide has no published variant", 400);
  }

  const { error: seedError } = await supabase
    .from("objective_revision_nodes")
    .upsert(
      closure
        .filter((id) => canonicalByBase.has(id))
        .map((id) => ({
          revision_id: revisionId,
          guide_base_id: id,
          guide_id: canonicalByBase.get(id) as string,
        })),
      { onConflict: "revision_id, guide_base_id", ignoreDuplicates: true }
    );

  if (seedError) {
    console.error(seedError);
    throw new ServiceError("Unable to update targets", 400);
  }

  const featuredIndex = targets.findIndex((t) => t.is_featured);
  const { error: flagError } = await supabase
    .from("objective_revision_nodes")
    .upsert(
      targets.map((t, i) => ({
        revision_id: revisionId,
        guide_base_id: t.guide_base_id,
        guide_id: canonicalByBase.get(t.guide_base_id) as string,
        is_target: true,
        is_included: true,
        target_position: i,
        is_featured: i === (featuredIndex === -1 ? 0 : featuredIndex),
      })),
      { onConflict: "revision_id, guide_base_id" }
    );

  if (flagError) {
    console.error(flagError);
    throw new ServiceError("Unable to update targets", 400);
  }

  if (targets.every((t) => t.sequence === undefined)) return;

  const sequenced = new Set(targets.flatMap((t) => t.sequence ?? []));
  const unreached = [...sequenced].find((id) => !closureSet.has(id));
  if (unreached) {
    throw new ServiceError("Sequenced topic is not in this objective", 400);
  }

  const { data: nodes, error: nodesError } = await supabase
    .from("objective_revision_nodes")
    .select("id, guide_base_id, is_target")
    .eq("revision_id", revisionId);

  if (nodesError) {
    console.error(nodesError);
    throw new ServiceError("Failed to load revision nodes", 500);
  }

  const nodeIdByBase = new Map(
    (nodes ?? []).map((n) => [n.guide_base_id, n.id])
  );
  const included = (nodes ?? [])
    .filter((n) => n.is_target || sequenced.has(n.guide_base_id))
    .map((n) => n.id);
  const excluded = (nodes ?? [])
    .filter((n) => !n.is_target && !sequenced.has(n.guide_base_id))
    .map((n) => n.id);

  for (const [ids, value] of [
    [included, true],
    [excluded, false],
  ] as const) {
    if (ids.length === 0) continue;
    const { error } = await selectInBatches(ids, (batch) =>
      supabase
        .from("objective_revision_nodes")
        .update({ is_included: value })
        .in("id", batch)
    );
    if (error) {
      console.error(error);
      throw new ServiceError("Unable to update curation", 400);
    }
  }

  const { error: dropError } = await supabase
    .from("objective_revision_node_orders")
    .delete()
    .eq("revision_id", revisionId);

  if (dropError) {
    console.error(dropError);
    throw new ServiceError("Unable to update curation", 400);
  }

  const rows = targets.flatMap((t) =>
    (t.sequence ?? []).map((baseId, position) => ({
      revision_id: revisionId,
      target_node_id: nodeIdByBase.get(t.guide_base_id) as string,
      node_id: nodeIdByBase.get(baseId) as string,
      position,
    }))
  );

  if (rows.length > 0) {
    const { error } = await supabase
      .from("objective_revision_node_orders")
      .insert(rows);

    if (error) {
      console.error(error);
      throw new ServiceError("Unable to update curation", 400);
    }
  }
}

// Publish the draft directly (no review gate): freeze its edge projection, point
// the objective at it, and freeze the slug on first publish in one transaction via the
// publish_objective_revision RPC. Returns the live slug for routing.
export async function publishObjectiveRevision(
  supabase: DB,
  revisionId: string
) {
  const { data: slug, error } = await supabase.rpc(
    "publish_objective_revision",
    {
      p_revision_id: revisionId,
    }
  );

  if (error) {
    if (error.code === "P0002")
      throw new ServiceError("Revision not found", 404);
    if (error.code === "42501")
      throw new ServiceError("Not permitted to publish this revision", 403);
    throw new ServiceError("Unable to publish revision", 400);
  }
  return { slug };
}

// Roll an older revision forward as a new draft: clone its nodes into a fresh
// draft on the same objective in one transaction via the rollback_objective_revision
// RPC. Edges are not copied; a draft projects them live and freezes them only at
// publish. Returns the draft revision id, so the client routes to its editor.
export async function rollbackObjectiveRevision(
  supabase: DB,
  revisionId: string,
  sourceRevisionId: string
) {
  const { data: revision_id, error } = await supabase.rpc(
    "rollback_objective_revision",
    {
      p_revision_id: revisionId,
      p_source_revision_id: sourceRevisionId,
    }
  );

  if (error) {
    if (error.code === "P0002")
      throw new ServiceError("Revision not found for this objective", 404);
    if (error.code === "42501")
      throw new ServiceError("Not permitted to roll back this revision", 403);
    throw new ServiceError("Unable to roll back revision", 400);
  }

  return { revision_id };
}

// One node from getRevisionSnapshot. Used both as a standalone entry (added /
// removed) and as the `from`/`to` halves of a NodeChange.
type SnapshotNode = {
  id: string;
  guide_base_id: string;
  guide_id: string;
  slug: string | null;
  title: string | null;
  is_target: boolean;
  is_included: boolean;
  is_featured: boolean;
  target_position: number | null;
  note: string | null;
};

// A node that exists on both revisions but differs in at least one field.
// Carries both versions so a split-view renderer can show the old state on
// the left and the new state on the right without a second round-trip to
// fetch the `from` revision's snapshot. `from` and `to` share the same
// guide_base_id (that's how we knew to pair them); every other field is
// independently rendered.
type NodeChange = {
  from: SnapshotNode;
  to: SnapshotNode;
};

// Rendered diff between two objective revision snapshots. RLS still
// applies; a hidden revision 404s. Compares title/summary fields, node
// membership (added/removed/changed, keyed by guide_base_id) and projected
// prerequisite edges (added/removed). Each side's edges are loaded with the
// correct projection (frozen for published, live for draft) via
// getRevisionSnapshot. Output arrays are sorted by a stable key so the diff
// is deterministic regardless of row order from Postgres.
export async function diffObjectiveRevisions(
  supabase: DB,
  id: string,
  otherId: string
) {
  const [fromRes, toRes] = await Promise.all([
    supabase
      .from("objective_revisions")
      .select(DIFF_REVISION_META)
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("objective_revisions")
      .select(DIFF_REVISION_META)
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

  const [fromSnapshot, toSnapshot] = await Promise.all([
    getRevisionSnapshot(
      supabase,
      id,
      from.status === "published" ? "frozen" : "live"
    ),
    getRevisionSnapshot(
      supabase,
      otherId,
      to.status === "published" ? "frozen" : "live"
    ),
  ]);

  const fromNodes = new Map(
    fromSnapshot.nodes.map((n) => [n.guide_base_id, n])
  );
  const toNodes = new Map(toSnapshot.nodes.map((n) => [n.guide_base_id, n]));

  const added: SnapshotNode[] = [];
  const removed: SnapshotNode[] = [];
  // Changed nodes carry both versions so a split-view renderer doesn't need
  // a second round-trip to fetch the `from` revision's snapshot. See
  // NodeChange for the full rationale.
  const changed: NodeChange[] = [];

  for (const node of toNodes.values()) {
    const fromNode = fromNodes.get(node.guide_base_id);
    if (!fromNode) {
      added.push(node);
    } else if (!sameNode(fromNode, node)) {
      changed.push({ from: fromNode, to: node });
    }
  }
  for (const node of fromNodes.values()) {
    if (!toNodes.has(node.guide_base_id)) {
      removed.push(node);
    }
  }

  const edgeKey = (e: { from_id: string; to_id: string }) =>
    `${e.from_id}|${e.to_id}`;
  const fromEdgeKeys = new Set(fromSnapshot.projected_edges.map(edgeKey));
  const toEdgeKeys = new Set(toSnapshot.projected_edges.map(edgeKey));

  const addedEdges = toSnapshot.projected_edges.filter(
    (e) => !fromEdgeKeys.has(edgeKey(e))
  );
  const removedEdges = fromSnapshot.projected_edges.filter(
    (e) => !toEdgeKeys.has(edgeKey(e))
  );

  // Sort outputs by a stable key so the diff is deterministic regardless of
  // the order rows come back from Postgres. Changed nodes are keyed by their
  // shared guide_base_id (from and to always agree on it).
  const byBaseId = (
    a: { guide_base_id: string },
    b: { guide_base_id: string }
  ) =>
    a.guide_base_id < b.guide_base_id
      ? -1
      : a.guide_base_id > b.guide_base_id
        ? 1
        : 0;
  const byChangedBaseId = (a: NodeChange, b: NodeChange) =>
    byBaseId(a.to, b.to);
  const byEdge = (
    a: { from_id: string; to_id: string },
    b: { from_id: string; to_id: string }
  ) => {
    if (a.from_id !== b.from_id) return a.from_id < b.from_id ? -1 : 1;
    return a.to_id < b.to_id ? -1 : 1;
  };
  added.sort(byBaseId);
  removed.sort(byBaseId);
  changed.sort(byChangedBaseId);
  addedEdges.sort(byEdge);
  removedEdges.sort(byEdge);

  return {
    from: toRevisionRef(from),
    to: toRevisionRef(to),
    fields: {
      title: diffField(from.title, to.title),
      summary: diffField(from.summary, to.summary),
    },
    nodes: { added, removed, changed },
    edges: { added: addedEdges, removed: removedEdges },
  };
}

// Two nodes with the same guide_base_id are "the same" iff every per-revision
// column matches. slug/title are excluded: both snapshots read them live from
// the current guide_bases row, so a paired node always agrees on them and they
// can never signal a change. id is excluded too: it is a per-revision surrogate,
// so paired nodes never share one.
function sameNode(
  a: {
    guide_id: string;
    is_target: boolean;
    is_included: boolean;
    is_featured: boolean;
    target_position: number | null;
    note: string | null;
  },
  b: {
    guide_id: string;
    is_target: boolean;
    is_included: boolean;
    is_featured: boolean;
    target_position: number | null;
    note: string | null;
  }
): boolean {
  return (
    a.guide_id === b.guide_id &&
    a.is_target === b.is_target &&
    a.is_included === b.is_included &&
    a.is_featured === b.is_featured &&
    a.target_position === b.target_position &&
    a.note === b.note
  );
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
