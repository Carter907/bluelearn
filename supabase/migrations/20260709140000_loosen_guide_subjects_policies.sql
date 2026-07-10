-- Open guide subject tagging to any authenticated contributor for both
-- tagging and untagging.
drop policy "Guide authors can tag their topics" on public.guide_subjects;
drop policy "Moderators can untag topics" on public.guide_subjects;

create policy "Contributors can tag topics"
  on public.guide_subjects for insert
  to authenticated
  with check (true);

create policy "Contributors can untag topics"
  on public.guide_subjects for delete
  to authenticated
  using (true);
