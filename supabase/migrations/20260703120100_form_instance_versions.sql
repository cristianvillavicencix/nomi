-- Form instance schema versioning (Part C.3)

create table public.form_instance_versions (
  id bigint generated always as identity primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  form_instance_id bigint not null references public.form_instances (id) on delete cascade,
  version_number int not null,
  schema jsonb not null,
  notes text,
  created_by_member_id bigint references public.organization_members (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (form_instance_id, version_number)
);

create index idx_form_versions_instance
  on public.form_instance_versions (form_instance_id, created_at desc);

alter table public.form_instance_versions enable row level security;

grant select, insert on public.form_instance_versions to authenticated;

create policy "form_versions_select" on public.form_instance_versions
  for select to authenticated
  using (org_id = public.current_user_org_id());

create policy "form_versions_insert" on public.form_instance_versions
  for insert to authenticated
  with check (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('forms.manage')
  );

create or replace function public.archive_form_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_version int;
begin
  if old.schema is distinct from new.schema then
    select coalesce(max(version_number), 0) + 1
    into next_version
    from public.form_instance_versions
    where form_instance_id = old.id;

    insert into public.form_instance_versions (
      org_id,
      form_instance_id,
      version_number,
      schema,
      created_by_member_id
    ) values (
      old.org_id,
      old.id,
      next_version,
      old.schema,
      public.current_user_member_id()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_archive_form_version on public.form_instances;

create trigger trg_archive_form_version
  before update on public.form_instances
  for each row execute function public.archive_form_version();
