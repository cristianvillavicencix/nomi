-- Ticket email inbox: inbound Postmark → tickets, outbound replies from inbox address

alter table public.tickets
  add column if not exists inbox_address text,
  add column if not exists requester_email text,
  add column if not exists requester_name text,
  add column if not exists external_thread_id text,
  add column if not exists merged_into_ticket_id bigint references public.tickets (id) on delete set null,
  add column if not exists merge_note text;

alter table public.ticket_messages
  add column if not exists direction text not null default 'outbound',
  add column if not exists from_email text,
  add column if not exists from_name text,
  add column if not exists to_emails text[] default '{}',
  add column if not exists external_message_id text,
  add column if not exists html_body text;

create index if not exists tickets_inbox_address_idx
  on public.tickets (inbox_address)
  where inbox_address is not null;

create index if not exists tickets_requester_email_idx
  on public.tickets (requester_email)
  where requester_email is not null;

create index if not exists ticket_messages_external_message_id_idx
  on public.ticket_messages (external_message_id)
  where external_message_id is not null;

create table if not exists public.ticket_inboxes (
  id bigserial primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  email text not null,
  display_name text,
  from_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (org_id, email)
);

create index if not exists ticket_inboxes_email_idx on public.ticket_inboxes (lower(email));

alter table public.ticket_inboxes enable row level security;

grant select on public.ticket_inboxes to authenticated;

create policy "ticket_inboxes_select_org" on public.ticket_inboxes
  for select to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('support.tickets.view')
  );

comment on table public.ticket_inboxes is
  'Shared support inboxes (e.g. supplements@lbs.bz) mapped to organizations for inbound email routing.';

-- Seed default inbox for existing orgs (idempotent)
insert into public.ticket_inboxes (org_id, email, display_name, from_name)
select o.id, 'supplements@lbs.bz', 'Supplements', 'LBS Supplements'
from public.organizations o
where not exists (
  select 1
  from public.ticket_inboxes ti
  where ti.org_id = o.id
    and lower(ti.email) = 'supplements@lbs.bz'
);
