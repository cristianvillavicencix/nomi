-- SendGrid Inbound Parse routing for ticket inboxes

alter table public.ticket_inboxes
  add column if not exists sendgrid_hostname text,
  add column if not exists sendgrid_forward_address text;

update public.ticket_inboxes
set
  sendgrid_hostname = 'supplements.lbs.bz',
  sendgrid_forward_address = 'inbox@supplements.lbs.bz'
where lower(email) = 'supplements@lbs.bz'
  and sendgrid_hostname is null;
