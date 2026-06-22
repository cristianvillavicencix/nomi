-- Per-member notification preferences (desktop categories, sound).

alter table public.organization_members
  add column if not exists notification_prefs jsonb not null default '{}'::jsonb;

comment on column public.organization_members.notification_prefs is
  'Per-member notification preferences: sound, desktop category toggles (merged with app defaults on read).';
