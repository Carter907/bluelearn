-- Grants permissions to SELECT guides as unauthenticated user
-- Grants permissions to INSERT guides as an authenticated user

GRANT SELECT on public.guides TO anon, authenticated;
GRANT INSERT ON public.guides TO authenticated;

GRANT SELECT ON public.guide_revisions TO anon, authenticated;
GRANT INSERT ON public.guide_revisions TO authenticated;

GRANT SELECT ON public.guide_bases TO anon, authenticated;
GRANT INSERT ON public.guide_bases TO authenticated;
