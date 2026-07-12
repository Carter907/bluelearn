-- Subject tags for objectives. Mirrors guide_subjects: a many-to-many join on the
-- stable objective node (not a revision).
create table public.objective_subjects (
  objective_id uuid not null references public.objectives (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  primary key (objective_id, subject_id)
);

create index objective_subjects_subject_id_idx
  on public.objective_subjects (subject_id);

-- Row-level security policies
alter table public.objective_subjects enable row level security;

create policy "Objective subject tags are viewable by everyone"
  on public.objective_subjects for select
  using (true);

create policy "Curators can tag objectives"
  on public.objective_subjects for insert
  to authenticated
  with check (public.has_role('curator'));

create policy "Curators and moderators can untag objectives"
  on public.objective_subjects for delete
  to authenticated
  using (
    public.has_role('curator')
    or public.has_role('moderator')
    or public.has_role('admin')
  );
