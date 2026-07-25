-- Personal / team tasks may belong to organization_member_id without a linked contact.

alter table public.tasks
  alter column contact_id drop not null;

alter table public.tasks
  drop constraint if exists tasks_contact_or_owner_check;

alter table public.tasks
  add constraint tasks_contact_or_owner_check
  check (contact_id is not null or organization_member_id is not null);
