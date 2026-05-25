-- Default SMS notify members for form submissions at org level

alter table public.organizations
  add column if not exists default_form_notify_member_ids bigint[] not null default '{}';

comment on column public.organizations.default_form_notify_member_ids is
  'Default member IDs that receive SMS when a form is submitted. Per-form override on form_instances.notify_member_ids.';

alter table public.public_form_tokens
  add column if not exists is_preview boolean not null default false;

create or replace function public.set_form_instance_default_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.notify_member_ids is null
    or cardinality(new.notify_member_ids) = 0 then
    select coalesce(o.default_form_notify_member_ids, '{}'::bigint[])
    into new.notify_member_ids
    from public.organizations o
    where o.id = new.org_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_form_default_notify on public.form_instances;

create trigger trg_set_form_default_notify
  before insert on public.form_instances
  for each row execute function public.set_form_instance_default_notify();
