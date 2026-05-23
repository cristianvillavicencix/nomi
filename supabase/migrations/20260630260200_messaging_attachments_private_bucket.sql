-- Hotfix #4: Private bucket for messaging MMS attachments.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'messaging-attachments',
  'messaging-attachments',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf'
  ]::text[]
)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "messaging_attachments_read" on storage.objects;
create policy "messaging_attachments_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'messaging-attachments'
    and exists (
      select 1
      from public.conversation_messages cm
      where cm.media_url = name
        and public.user_can_access_conversation(cm.conversation_id)
    )
  );

drop policy if exists "messaging_attachments_insert" on storage.objects;
create policy "messaging_attachments_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'messaging-attachments'
    and public.current_member_has_capability('messaging.send')
  );

drop policy if exists "messaging_attachments_service_insert" on storage.objects;
create policy "messaging_attachments_service_insert" on storage.objects
  for insert to service_role
  with check (bucket_id = 'messaging-attachments');

drop policy if exists "messaging_attachments_delete" on storage.objects;
create policy "messaging_attachments_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'messaging-attachments'
    and public.current_member_has_capability('messaging.settings.manage')
  );

comment on column public.conversation_messages.media_url is
  'Storage object path in bucket messaging-attachments (not a public URL). Legacy rows may still hold full URLs.';
