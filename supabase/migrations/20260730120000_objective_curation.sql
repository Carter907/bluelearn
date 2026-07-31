create or replace function public.objective_closure(p_targets uuid[])
returns table (guide_base_id uuid)
language sql
security invoker
set search_path = ''
stable
as $$
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
  select node_id from closure;
$$;

grant execute on function public.objective_closure(uuid[]) to authenticated;

drop policy if exists "Curators can edit nodes of their own draft revisions"
  on public.objective_revision_nodes;

create policy "Curators can edit nodes of their own draft revisions"
  on public.objective_revision_nodes for all
  to authenticated
  using (
    public.has_role('curator')
    and exists (
      select 1 from public.objective_revisions r
      where r.id = revision_id
        and r.author_id = (select auth.uid())
        and r.status = 'draft'
    )
  )
  with check (
    public.has_role('curator')
    and exists (
      select 1 from public.objective_revisions r
      where r.id = revision_id
        and r.author_id = (select auth.uid())
        and r.status = 'draft'
    )
  );

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
    (revision_id, guide_base_id, guide_id, is_target, is_included, note,
     target_position, is_featured)
  select v_new_revision_id, guide_base_id, guide_id, is_target, is_included, note,
     target_position, is_featured
    from public.objective_revision_nodes
    where revision_id = p_source_revision_id;

  insert into public.objective_revision_node_orders
    (revision_id, target_node_id, node_id, position)
  select v_new_revision_id, tn.id, sn.id, o.position
    from public.objective_revision_node_orders o
    join public.objective_revision_nodes src_t on src_t.id = o.target_node_id
    join public.objective_revision_nodes src_n on src_n.id = o.node_id
    join public.objective_revision_nodes tn
      on tn.revision_id = v_new_revision_id
     and tn.guide_base_id = src_t.guide_base_id
    join public.objective_revision_nodes sn
      on sn.revision_id = v_new_revision_id
     and sn.guide_base_id = src_n.guide_base_id
    where o.revision_id = p_source_revision_id;

  -- Return the draft revision id so the client routes straight to its editor.
  return v_new_revision_id;
end;
$$;

grant execute on function public.rollback_objective_revision(uuid, uuid)
  to authenticated;
