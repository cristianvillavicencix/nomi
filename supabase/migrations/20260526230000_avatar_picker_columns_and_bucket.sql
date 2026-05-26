-- Adds explicit avatar_type / avatar_url columns to both user-bearing
-- tables so the new AvatarPicker can persist the user's choice (peep,
-- upload, or default). The legacy `avatar` jsonb stays untouched for
-- backwards compatibility; resolvers prefer the new columns when set.

alter table public.organization_members
  add column if not exists avatar_type text check (avatar_type in ('peep', 'upload', 'default')),
  add column if not exists avatar_url text;

alter table public.people
  add column if not exists avatar_type text check (avatar_type in ('peep', 'upload', 'default')),
  add column if not exists avatar_url text;

-- Dedicated public bucket for avatars. Avatars are tiny and safe to make
-- publicly readable; uploads are gated by RLS so users can only manage
-- files in their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage RLS: anyone can read (bucket is public), only the owner can
-- write/update/delete files in their own user folder ({auth.uid}/...).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'avatars_public_read') then
    create policy "avatars_public_read"
      on storage.objects for select
      using (bucket_id = 'avatars');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'avatars_owner_write') then
    create policy "avatars_owner_write"
      on storage.objects for insert
      to authenticated
      with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'avatars_owner_update') then
    create policy "avatars_owner_update"
      on storage.objects for update
      to authenticated
      using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'avatars_owner_delete') then
    create policy "avatars_owner_delete"
      on storage.objects for delete
      to authenticated
      using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
end $$;
