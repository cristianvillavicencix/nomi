-- Link deal_resources rows back to form_submissions_v2 when created by wizard

alter table public.deal_resources
  add column if not exists submitted_by_form bigint references public.form_submissions_v2 (id) on delete set null;

create index if not exists idx_deal_resources_form on public.deal_resources (submitted_by_form)
  where submitted_by_form is not null;

comment on column public.deal_resources.submitted_by_form is
  'Form submission that created this resource (e.g. project resources wizard)';

-- Public form uploads bucket (private; team reads via authenticated policies)
insert into storage.buckets (id, name, public, file_size_limit)
values ('form-uploads', 'form-uploads', false, 20971520)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

drop policy if exists "form_uploads_anon_insert" on storage.objects;
create policy "form_uploads_anon_insert" on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'form-uploads'
    and (storage.foldername(name))[1] = 'submissions'
  );

drop policy if exists "form_uploads_org_select" on storage.objects;
create policy "form_uploads_org_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'form-uploads'
    and (storage.foldername(name))[2]::bigint = public.current_user_org_id()
  );
