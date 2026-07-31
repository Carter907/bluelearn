-- Drop guide_bases.title because it can cause drift between guide_bases.title 
-- and current revision title.

-- Same as the previous close_review_panel except a first publish now also
-- freezes the base's own slug (unique across all bases).
create or replace function public.close_review_panel(p_case_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_panel_id uuid;
  v_target integer;
  v_case_type public.case_type;
  v_majority integer;
  v_approve integer;
  v_reject integer;
  v_outcome public.review_outcome;
  v_revision_id uuid;
  v_guide_id uuid;
  v_base_id uuid;
  v_base_slug text;
  v_title text;
  v_slug_base text;
  v_slug text;
  v_suffix integer;
  v_subject record;
begin
  select rp.id, rp.target_seat_count, rc.case_type
    into v_panel_id, v_target, v_case_type
    from public.review_panels rp
    join public.review_cases rc on rc.id = rp.case_id
    where rp.case_id = p_case_id and rp.closed_at is null
    for update of rp;

  if not found then
    return;
  end if;

  v_majority := v_target / 2 + 1;
  select
    count(*) filter (where d.decision = 'approved'),
    count(*) filter (where d.decision = 'rejected')
    into v_approve, v_reject
    from public.panel_members pm
    join public.review_decisions d on d.panel_member_id = pm.id
    where pm.panel_id = v_panel_id;

  if v_approve >= v_majority then
    v_outcome := 'approved';
  elsif v_reject >= v_majority then
    v_outcome := 'rejected';
  else
    return;
  end if;

  update public.review_panels
    set outcome = v_outcome, closed_at = now()
    where id = v_panel_id;

  update public.review_cases
    set status = v_outcome::text::public.case_status
    where id = p_case_id;

  if v_outcome <> 'approved' then
    return;
  end if;

  select grc.guide_revision_id, gr.guide_id, g.guide_base_id, gr.title, b.slug
    into v_revision_id, v_guide_id, v_base_id, v_title, v_base_slug
    from public.guide_review_cases grc
    join public.guide_revisions gr on gr.id = grc.guide_revision_id
    join public.guides g on g.id = gr.guide_id
    join public.guide_bases b on b.id = g.guide_base_id
    where grc.case_id = p_case_id;

  update public.guide_revisions
    set approved_at = now()
    where id = v_revision_id;

  if v_case_type = 'guide_publish' then
    v_slug_base := lower(
      trim(both '-' from regexp_replace(coalesce(v_title, ''), '[^a-zA-Z0-9]+', '-', 'g'))
    );
    if v_slug_base = '' then
      v_slug_base := 'guide';
    end if;
    v_slug := v_slug_base;
    v_suffix := 1;
    while exists (
      select 1 from public.guides
      where guide_base_id = v_base_id and slug = v_slug and id <> v_guide_id
    ) loop
      v_suffix := v_suffix + 1;
      v_slug := v_slug_base || '-' || v_suffix;
    end loop;

    update public.guides
      set current_revision_id = v_revision_id,
          status = 'published',
          slug = coalesce(slug, v_slug)
      where id = v_guide_id;

    -- The /{base-slug} handle. Only the first publish mints it; later renames
    -- leave it alone, same as guides.slug.
    if v_base_slug is null then
      v_slug := v_slug_base;
      v_suffix := 1;
      while exists (
        select 1 from public.guide_bases where slug = v_slug and id <> v_base_id
      ) loop
        v_suffix := v_suffix + 1;
        v_slug := v_slug_base || '-' || v_suffix;
      end loop;
      v_base_slug := v_slug;
    end if;

    update public.guide_bases
      set status = 'published',
          canonical_guide_id = coalesce(canonical_guide_id, v_guide_id),
          slug = coalesce(slug, v_base_slug)
      where id = v_base_id;
  else
    update public.guides
      set current_revision_id = v_revision_id
      where id = v_guide_id;
  end if;

  for v_subject in
    select s.id, s.name
      from public.subjects s
      join public.guide_revision_subjects grs on grs.subject_id = s.id
      where grs.guide_revision_id = v_revision_id
        and s.slug is null
      for update of s
  loop
    v_slug_base := lower(
      trim(both '-' from regexp_replace(coalesce(v_subject.name, ''), '[^a-zA-Z0-9]+', '-', 'g'))
    );
    if v_slug_base = '' then
      v_slug_base := 'subject';
    end if;
    v_slug := v_slug_base;
    v_suffix := 1;
    while exists (
      select 1 from public.subjects where slug = v_slug
    ) loop
      v_suffix := v_suffix + 1;
      v_slug := v_slug_base || '-' || v_suffix;
    end loop;

    update public.subjects set slug = v_slug where id = v_subject.id;
  end loop;

  update public.subjects s
    set status = 'published'
    from public.guide_revision_subjects grs
    where grs.guide_revision_id = v_revision_id
      and grs.subject_id = s.id
      and s.status <> 'published';
end;
$$;

grant execute on function public.close_review_panel(uuid) to authenticated, service_role;

-- Same as the previous compute_walkthrough except node titles come off the
-- canonical revision instead of the base.
create or replace function public.compute_walkthrough(p_guide_base_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
stable
as $$
  -- closure c: the target plus every transitive prerequisite.
  with recursive closure as (
    select p_guide_base_id as node_id
    union
    select e.from_guide_base_id
    from closure c
    join public.guide_edges e
      on e.to_guide_base_id = c.node_id
     and e.edge_type = 'prerequisite'
     and not e.is_suspended
  ),
  -- fp = forward_paths. Walks the closure from its roots, so a node's level
  -- counts prerequisite hops behind it rather than hops back from the
  -- target.
  forward_paths as (
    select c.node_id, 1 as level
    from closure c
    where not exists (
      select 1 from public.guide_edges e
      where e.to_guide_base_id = c.node_id
        and e.edge_type = 'prerequisite'
        and not e.is_suspended
    )
    union
    select e.to_guide_base_id, fp.level + 1
    from forward_paths fp
    join public.guide_edges e
      on e.from_guide_base_id = fp.node_id
     and e.edge_type = 'prerequisite'
     and not e.is_suspended
    join closure c on c.node_id = e.to_guide_base_id
    where fp.level < 100 -- safeguard against cycles
  ),
  node_levels as (
    select node_id, max(level) as level
    from forward_paths
    group by node_id
  ),
  visible_nodes as (
    select nl.node_id, nl.level, gb.slug, cr.title, cr.summary, cr.word_count, cr.id as revision_id
    from node_levels nl
    join public.guide_bases gb on gb.id = nl.node_id
    left join public.guides cg on cg.id = gb.canonical_guide_id
    left join public.guide_revisions cr on cr.id = cg.current_revision_id
  ),
  visible_edges as (
    select e.from_guide_base_id as from_id, e.to_guide_base_id as to_id
    from public.guide_edges e
    where e.edge_type = 'prerequisite'
      and not e.is_suspended
      and e.from_guide_base_id in (select node_id from visible_nodes)
      and e.to_guide_base_id in (select node_id from visible_nodes)
  )
  select jsonb_build_object(
    'nodes', coalesce(
      (select jsonb_agg(
        jsonb_build_object(
          'id', vn.node_id,
          'slug', vn.slug,
          'title', vn.title,
          'summary', vn.summary,
          'level', vn.level,
          'word_count', coalesce(vn.word_count, 0),
          'tags', coalesce(
            (select jsonb_agg(jsonb_build_object('slug', s.slug, 'name', s.name))
             from public.guide_revision_subjects grs
             join public.subjects s on s.id = grs.subject_id
             where grs.guide_revision_id = vn.revision_id),
            '[]'::jsonb
          )
        )
        order by vn.level, vn.slug
      ) from visible_nodes vn),
      '[]'::jsonb
    ),
    'edges', coalesce(
      (select jsonb_agg(
        jsonb_build_object('from_id', from_id, 'to_id', to_id)
      ) from visible_edges),
      '[]'::jsonb
    )
  );
$$;

grant execute on function public.compute_walkthrough(uuid) to anon, authenticated;

alter table public.guide_bases drop column title;

-- A published guide base flattened with its canonical guide and that guide's
-- live revision. Card listings need to order and paginate by title, and
-- PostgREST cannot sort a top-level query by a column two embeds deep.
create view public.published_guides with (security_invoker = on) as
select
  gb.id,
  gb.slug as base_slug,
  gb.knowledge_type,
  gb.status,
  gb.created_at,
  g.id as guide_id,
  g.slug as guide_slug,
  g.author_id,
  r.id as revision_id,
  r.title,
  r.summary,
  r.word_count,
  (
    select coalesce(array_agg(grs.subject_id), '{}'::uuid[])
    from public.guide_revision_subjects grs
    where grs.guide_revision_id = r.id
  ) as subject_ids
from public.guide_bases gb
join public.guides g on g.id = gb.canonical_guide_id
join public.guide_revisions r on r.id = g.current_revision_id
where gb.status = 'published';

grant select on public.published_guides to anon, authenticated, service_role;
