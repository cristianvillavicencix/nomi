-- Map Postmark inbound hash address → ticket inbox (Hostinger forwards supplements@ → inbound)

alter table public.ticket_inboxes
  add column if not exists postmark_inbound_address text;

create index if not exists ticket_inboxes_postmark_inbound_idx
  on public.ticket_inboxes (lower(postmark_inbound_address))
  where postmark_inbound_address is not null;

update public.ticket_inboxes
set postmark_inbound_address = '2aff30e603e54dc3eb556bd9e03ee099@inbound.postmarkapp.com'
where lower(email) = 'supplements@lbs.bz'
  and postmark_inbound_address is null;
