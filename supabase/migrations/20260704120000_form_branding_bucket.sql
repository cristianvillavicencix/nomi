-- Public bucket for form logos and background images (org-scoped upload paths)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'form-branding',
  'form-branding',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "form_branding_upload" on storage.objects;
create policy "form_branding_upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'form-branding'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
  );

drop policy if exists "form_branding_update" on storage.objects;
create policy "form_branding_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'form-branding'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
  )
  with check (
    bucket_id = 'form-branding'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
  );

drop policy if exists "form_branding_delete" on storage.objects;
create policy "form_branding_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'form-branding'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
  );

drop policy if exists "form_branding_public_read" on storage.objects;
create policy "form_branding_public_read" on storage.objects
  for select to public
  using (bucket_id = 'form-branding');
