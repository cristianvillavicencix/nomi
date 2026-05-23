-- LBS agency assets: visibility + private project-files bucket + tighter RLS

alter table public.deal_resources
  add column if not exists visibility text not null default 'internal',
  add column if not exists mime_kind text;

alter table public.deal_resources drop constraint if exists deal_resources_visibility_check;
alter table public.deal_resources
  add constraint deal_resources_visibility_check
  check (visibility in ('internal', 'client', 'public'));

comment on column public.deal_resources.visibility is
  'internal = team only; client = visible to client upload context; public = shareable link';
comment on column public.deal_resources.mime_kind is
  'image | document | video | other — derived from mime type';

-- Private bucket for project assets (replaces public attachments URLs for new uploads)
insert into storage.buckets (id, name, public, file_size_limit)
values ('project-files', 'project-files', false, 52428800)
on conflict (id) do update set public = excluded.public;

drop policy if exists "deal_resources_select_scoped" on public.deal_resources;
drop policy if exists "Deal resources org scoped" on public.deal_resources;

create policy "deal_resources_select_scoped" on public.deal_resources
  for select to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.can_view_deal(deal_id)
  );

create policy "deal_resources_insert_scoped" on public.deal_resources
  for insert to authenticated
  with check (
    org_id = public.current_user_org_id()
    and public.can_view_deal(deal_id)
  );

create policy "deal_resources_update_scoped" on public.deal_resources
  for update to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.can_view_deal(deal_id)
  )
  with check (
    org_id = public.current_user_org_id()
    and public.can_view_deal(deal_id)
  );

create policy "deal_resources_delete_scoped" on public.deal_resources
  for delete to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.can_view_deal(deal_id)
  );

drop policy if exists "project_files_read" on storage.objects;
create policy "project_files_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'project-files'
    and exists (
      select 1
      from public.deal_resources dr
      where dr.file->>'path' = name
        and dr.org_id = public.current_user_org_id()
        and public.can_view_deal(dr.deal_id)
    )
  );

drop policy if exists "project_files_insert" on storage.objects;
create policy "project_files_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'project-files'
    and public.current_member_has_capability('crm.pipeline.edit')
  );

drop policy if exists "project_files_service" on storage.objects;
create policy "project_files_service" on storage.objects
  for all to service_role
  using (bucket_id = 'project-files')
  with check (bucket_id = 'project-files');
