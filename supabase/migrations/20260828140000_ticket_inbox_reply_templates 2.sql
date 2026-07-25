-- Custom reply templates per ticket inbox (used in ticket composer).

alter table public.ticket_inboxes
  add column if not exists reply_templates jsonb not null default '[]'::jsonb;

comment on column public.ticket_inboxes.reply_templates is
  'Custom ticket reply templates: [{ id, label, description?, body }] with {{clientName}} variables.';
