-- Mail attachment files were uploaded by the worker/service role but authenticated
-- users could not open them: the mail-attachments storage SELECT policy was missing.

drop policy if exists mail_attachments_storage_select on storage.objects;

create policy mail_attachments_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'mail-attachments'
    and exists (
      select 1
      from public.mail_accounts a
      where a.org_id = public.current_user_org_id()
        and a.id = nullif((storage.foldername(name))[2], '')::bigint
        and public.mail_account_is_readable(a)
    )
  );

-- Orphan rows block IMAP re-sync from re-uploading missing files.
delete from public.mail_attachments ma
where ma.storage_path is not null
  and not exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'mail-attachments'
      and o.name = ma.storage_path
  );
