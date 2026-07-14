alter table public.objective_revision_nodes
  add column id uuid not null default gen_random_uuid();

alter table public.objective_revision_nodes
  add constraint objective_revision_nodes_revision_base_key
  unique (revision_id, guide_base_id);

alter table public.objective_revision_nodes
  add constraint objective_revision_nodes_id_revision_key
  unique (id, revision_id);

-- rename learning path constraints to objective
alter table public.objective_revision_edges
  drop constraint learning_path_revision_edges_from_is_node,
  drop constraint learning_path_revision_edges_to_is_node;

alter table public.objective_revision_nodes
  drop constraint learning_path_revision_nodes_pkey;

alter table public.objective_revision_nodes
  add constraint objective_revision_nodes_pkey primary key (id);

alter table public.objective_revision_edges
  add constraint objective_revision_edges_from_is_node
    foreign key (revision_id, from_guide_base_id)
    references public.objective_revision_nodes (revision_id, guide_base_id)
    on delete cascade,
  add constraint objective_revision_edges_to_is_node
    foreign key (revision_id, to_guide_base_id)
    references public.objective_revision_nodes (revision_id, guide_base_id)
    on delete cascade;

-- A node shared across targets holds a separate row and its own position under
-- each target. Rows are authored by the curator on a draft and frozen once the
-- revision publishes.
create table public.objective_revision_node_orders (
  revision_id uuid not null references public.objective_revisions (id) on delete cascade,
  target_node_id uuid not null,
  node_id uuid not null,
  position integer not null,
  primary key (revision_id, target_node_id, node_id),
  -- Both the target and the placed node must be nodes of this same revision.
  constraint objective_revision_node_orders_target_is_node
    foreign key (target_node_id, revision_id)
    references public.objective_revision_nodes (id, revision_id)
    on delete cascade,
  constraint objective_revision_node_orders_node_is_node
    foreign key (node_id, revision_id)
    references public.objective_revision_nodes (id, revision_id)
    on delete cascade,
  constraint objective_revision_node_orders_position_non_negative
    check (position >= 0)
);

alter table public.objective_revision_node_orders enable row level security;
create policy "Objective orders are viewable when their revision is"
  on public.objective_revision_node_orders for select
  using (
    exists (
      select 1 from public.objective_revisions r
      where r.id = revision_id
        and (r.status = 'published' or r.author_id = (select auth.uid()))
    )
  );

create policy "Curators can edit orders of their own draft revisions"
  on public.objective_revision_node_orders for all
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
