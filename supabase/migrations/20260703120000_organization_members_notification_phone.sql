-- SMS notification phone per organization member (independent of auth.users.phone)

alter table public.organization_members
  add column if not exists notification_phone text;

comment on column public.organization_members.notification_phone is
  'Phone number for SMS notifications (forms, alerts, etc). Format E.164 (+12035551234). Separate from auth phone.';

alter table public.organization_members
  drop constraint if exists notification_phone_format;

alter table public.organization_members
  add constraint notification_phone_format
  check (
    notification_phone is null
    or notification_phone ~ '^\+[1-9]\d{1,14}$'
  );

create index if not exists idx_org_members_notification_phone
  on public.organization_members (org_id)
  where notification_phone is not null;
