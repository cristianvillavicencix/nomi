-- Ticket board classification (independent of billing).
alter table public.tickets
  add column if not exists service_types text[] not null default '{}'::text[];

comment on column public.tickets.service_types is
  'User-facing work classification for the ticket board (e.g. xactimate, roof, siding). Not derived from billing.';

create index if not exists tickets_service_types_gin_idx
  on public.tickets using gin (service_types);
