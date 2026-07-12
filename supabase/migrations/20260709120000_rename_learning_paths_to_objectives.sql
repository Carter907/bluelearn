-- Rename learning paths to objectives across the schema.

alter type public.learning_path_revision_status
  rename to objective_revision_status;

alter table public.learning_paths rename to objectives;
alter table public.learning_path_revisions rename to objective_revisions;
alter table public.learning_path_revision_nodes rename to objective_revision_nodes;
alter table public.learning_path_revision_edges rename to objective_revision_edges;

alter table public.objective_revisions
  rename column learning_path_id to objective_id;

alter table public.objective_revisions
  rename constraint learning_path_revisions_learning_path_id_fkey
  to objective_revisions_objective_id_fkey;

alter table public.objectives
  rename constraint learning_paths_current_revision_id_fkey
  to objectives_current_revision_id_fkey;

drop function if exists public.create_learning_path(uuid[], text, text);
drop function if exists public.publish_learning_path_revision(uuid);
drop function if exists public.rollback_learning_path_revision(uuid, uuid);
drop function if exists public.project_path_edges(uuid);

create or replace function public.create_objective(
  p_targets uuid[],
  p_title text default null,
  p_summary text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_objective_id uuid := gen_random_uuid();
  v_revision_id uuid := gen_random_uuid();
begin
  if p_targets is null or array_length(p_targets, 1) is null then
    raise exception 'At least one target guide base is required'
      using errcode = 'invalid_parameter_value';
  end if;

  insert into public.objectives (id, created_by, status)
    values (v_objective_id, auth.uid(), 'draft');

  insert into public.objective_revisions
    (id, objective_id, title, summary, author_id, status)
    values (v_revision_id, v_objective_id, p_title, p_summary, auth.uid(), 'draft');

  -- closure: the targets plus every transitive prerequisite, walking guide_edges
  -- backward (from a known node to its prerequisites). Each node is seeded as a
  -- membership row through its base's canonical variant; the targets are flagged.
  insert into public.objective_revision_nodes
    (revision_id, guide_base_id, guide_id, is_target)
  with recursive closure as (
    select unnest(p_targets) as node_id
    union
    select e.from_guide_base_id
    from closure c
    join public.guide_edges e
      on e.to_guide_base_id = c.node_id
     and e.edge_type = 'prerequisite'
     and not e.is_suspended
  )
  select
    v_revision_id,
    gb.id,
    gb.canonical_guide_id,
    gb.id = any (p_targets)
  from closure c
  join public.guide_bases gb on gb.id = c.node_id;

  -- Return the draft revision id so the client routes straight to its editor.
  return v_revision_id;
end;
$$;

grant execute on function public.create_objective(uuid[], text, text)
  to authenticated;

-- Project guide_edges onto a revision's included nodes, recursing backward
-- through excluded intermediates so a skipped prereq (A -> Trig -> B with Trig
-- excluded) bridges to A -> B.
create or replace function public.project_objective_edges(p_revision_id uuid)
returns table (from_guide_base_id uuid, to_guide_base_id uuid)
language sql
security invoker
set search_path = ''
stable
as $$
  with recursive
  included as (
    select guide_base_id
    from public.objective_revision_nodes
    where revision_id = p_revision_id
  ),
  -- anchor = the included node we are finding prerequisites for; cur = the node
  -- reached walking backward from it.
  walk as (
    select n.guide_base_id as anchor, e.from_guide_base_id as cur
    from included n
    join public.guide_edges e
      on e.to_guide_base_id = n.guide_base_id
     and e.edge_type = 'prerequisite'
     and not e.is_suspended
    union
    select w.anchor, e.from_guide_base_id
    from walk w
    join public.guide_edges e
      on e.to_guide_base_id = w.cur
     and e.edge_type = 'prerequisite'
     and not e.is_suspended
    where w.cur not in (select guide_base_id from included)
  )
  select distinct cur as from_guide_base_id, anchor as to_guide_base_id
  from walk
  where cur in (select guide_base_id from included);
$$;

grant execute on function public.project_objective_edges(uuid) to authenticated;

create or replace function public.publish_objective_revision(p_revision_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_objective_id uuid;
  v_status public.objective_revision_status;
  v_author_id uuid;
  v_title text;
  v_slug text;
begin
  if not public.has_role('curator') then
    raise exception 'Only curators can publish objectives'
      using errcode = 'insufficient_privilege';
  end if;

  select objective_id, status, author_id, title
    into v_objective_id, v_status, v_author_id, v_title
    from public.objective_revisions
    where id = p_revision_id
    for update;

  if not found then
    raise exception 'Revision not found' using errcode = 'no_data_found';
  end if;

  if v_author_id is distinct from (select auth.uid()) then
    raise exception 'You can only publish a revision you authored'
      using errcode = 'insufficient_privilege';
  end if;

  if v_status <> 'draft' then
    raise exception 'Revision is not an editable draft'
      using errcode = 'invalid_parameter_value';
  end if;

  -- On first publish the objective has no slug yet; derive and freeze it from
  -- the title, which must be present by then.
  select slug into v_slug from public.objectives where id = v_objective_id;
  if v_slug is null and coalesce(trim(v_title), '') = '' then
    raise exception 'A title is required to publish an objective'
      using errcode = 'invalid_parameter_value';
  end if;

  update public.objective_revisions
    set status = 'published',
        published_at = now()
    where id = p_revision_id;

  insert into public.objective_revision_edges
    (revision_id, from_guide_base_id, to_guide_base_id)
  select p_revision_id, e.from_guide_base_id, e.to_guide_base_id
    from public.project_objective_edges(p_revision_id) e;

  update public.objectives
    set current_revision_id = p_revision_id,
        status = 'published',
        slug = coalesce(
          slug,
          lower(trim(both '-' from
            regexp_replace(v_title, '[^a-zA-Z0-9]+', '-', 'g')))
        )
    where id = v_objective_id
    returning slug into v_slug;

  -- Return the live slug so the client can route to /objectives/{slug}.
  return v_slug;
end;
$$;

grant execute on function public.publish_objective_revision(uuid) to authenticated;

-- Rolling back clones an older revision's nodes into a fresh draft on the same
-- objective. The content lives in child node rows, so the clone is an insert
-- across two tables; doing it in one RPC keeps a partial failure from leaving an
-- empty draft.
create or replace function public.rollback_objective_revision(
  p_revision_id uuid,
  p_source_revision_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_objective_id uuid;
  v_title text;
  v_summary text;
  v_created_at timestamptz;
  v_new_revision_id uuid := gen_random_uuid();
begin
  -- The anchor revision names the objective being rolled back. RLS hides
  -- revisions the caller may not read, so an unseen one reads as missing.
  select objective_id into v_objective_id
    from public.objective_revisions
    where id = p_revision_id;

  if not found then
    raise exception 'Revision not found' using errcode = 'no_data_found';
  end if;

  -- The source must belong to that same objective or there is nothing to
  -- restore here.
  select title, summary, created_at
    into v_title, v_summary, v_created_at
    from public.objective_revisions
    where id = p_source_revision_id
      and objective_id = v_objective_id;

  if not found then
    raise exception 'Revision not found for this objective'
      using errcode = 'no_data_found';
  end if;

  insert into public.objective_revisions
    (id, objective_id, title, summary, change_summary, author_id, status)
    values (
      v_new_revision_id,
      v_objective_id,
      v_title,
      v_summary,
      'Rolled back to revision from ' || to_char(v_created_at, 'YYYY-MM-DD'),
      auth.uid(),
      'draft'
    );

  insert into public.objective_revision_nodes
    (revision_id, guide_base_id, guide_id, is_target, is_included, note)
  select v_new_revision_id, guide_base_id, guide_id, is_target, is_included, note
    from public.objective_revision_nodes
    where revision_id = p_source_revision_id;

  -- Return the draft revision id so the client routes straight to its editor.
  return v_new_revision_id;
end;
$$;

grant execute on function public.rollback_objective_revision(uuid, uuid)
  to authenticated;
