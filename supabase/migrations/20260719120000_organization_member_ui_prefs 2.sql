-- Per-member UI preferences (desktop navigation layout, etc.).

alter table public.organization_members
  add column if not exists ui_prefs jsonb not null default '{}'::jsonb;

comment on column public.organization_members.ui_prefs is
  'Per-member UI preferences (e.g. navigation_layout: sidebar | top).';
