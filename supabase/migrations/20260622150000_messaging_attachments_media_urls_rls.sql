-- Allow signed URL access for every path in conversation_messages.media_urls,
-- not only the legacy single media_url column.

drop policy if exists "messaging_attachments_read" on storage.objects;
create policy "messaging_attachments_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'messaging-attachments'
    and exists (
      select 1
      from public.conversation_messages cm
      where (
        cm.media_url = name
        or name = any(cm.media_urls)
      )
        and public.user_can_access_conversation(cm.conversation_id)
    )
  );
