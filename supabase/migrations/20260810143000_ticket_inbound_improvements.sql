-- Ticket inbound: failure log for SendGrid/Postmark/manual import diagnostics

create table if not exists public.ticket_inbound_failures (
  id bigserial primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  inbox_id bigint references public.ticket_inboxes (id) on delete set null,
  from_email text,
  from_name text,
  subject text,
  error_message text not null,
  error_code text,
  external_message_id text,
  skipped_attachments jsonb not null default '[]'::jsonb,
  source text not null default 'sendgrid',
  ticket_id bigint references public.tickets (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ticket_inbound_failures_org_created_idx
  on public.ticket_inbound_failures (org_id, created_at desc);

create index if not exists ticket_inbound_failures_unresolved_idx
  on public.ticket_inbound_failures (org_id, created_at desc)
  where resolved_at is null;

alter table public.ticket_inbound_failures enable row level security;

grant select, update on public.ticket_inbound_failures to authenticated;

create policy "ticket_inbound_failures_select_org"
  on public.ticket_inbound_failures
  for select
  to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('support.tickets.view')
  );

create policy "ticket_inbound_failures_update_org"
  on public.ticket_inbound_failures
  for update
  to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('support.tickets.manage')
  )
  with check (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('support.tickets.manage')
  );

comment on table public.ticket_inbound_failures is
  'Inbound ticket email failures and partial-ingest warnings for operator review.';
