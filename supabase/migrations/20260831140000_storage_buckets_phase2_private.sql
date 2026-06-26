-- Security Advisor phase 2: private storage buckets (no public listing).
-- Access via existing RLS policies + signed URLs in app and edge functions.

update storage.buckets
set public = false
where id in ('attachments', 'avatars', 'form-branding');

-- Upsert/replace requires UPDATE in addition to INSERT + SELECT.
drop policy if exists "attachments_authenticated_update" on storage.objects;
create policy "attachments_authenticated_update"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'attachments')
  with check (bucket_id = 'attachments');

-- form-branding: keep org-scoped write + public read via RLS (bucket no longer listable).
drop policy if exists "form_branding_public_read" on storage.objects;
create policy "form_branding_public_read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'form-branding');

-- avatars: readable via RLS when bucket is private (signed URLs in CRM UI).
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'avatars');

-- favicons_excluded_domains: replace always-true ALL policy with scoped read.
drop policy if exists "Enable access for authenticated users only" on public.favicons_excluded_domains;

create policy "favicons_excluded_domains_read_authenticated"
  on public.favicons_excluded_domains
  for select
  to authenticated
  using ((select auth.uid()) is not null);

create policy "favicons_excluded_domains_service_role_all"
  on public.favicons_excluded_domains
  for all
  to service_role
  using (true)
  with check (true);
