-- Allow signed URLs for project-files when path is only stored inside file.src (legacy rows).

drop policy if exists "project_files_read" on storage.objects;

create policy "project_files_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'project-files'
    and exists (
      select 1
      from public.deal_resources dr
      where dr.org_id = public.current_user_org_id()
        and public.can_view_deal(dr.deal_id)
        and (
          dr.file->>'path' = name
          or (
            dr.file->>'src' is not null
            and dr.file->>'src' like '%' || replace(name, ' ', '%') || '%'
          )
        )
    )
  );
