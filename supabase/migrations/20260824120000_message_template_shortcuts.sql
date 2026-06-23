-- Quick-access SMS template tiles in the Messages composer.

alter table public.message_templates
  add column if not exists composer_shortcut boolean not null default false,
  add column if not exists shortcut_label text,
  add column if not exists tile_color text,
  add column if not exists shortcut_sort_order integer not null default 0;

comment on column public.message_templates.composer_shortcut is
  'When true, shown as a quick-insert tile above the SMS composer.';
comment on column public.message_templates.shortcut_label is
  '1–3 character label on the composer tile (defaults from template name).';
comment on column public.message_templates.tile_color is
  'Optional hex color for the composer tile background.';

create index if not exists idx_message_templates_composer_shortcut
  on public.message_templates (org_id, shortcut_sort_order, name)
  where composer_shortcut and not is_archived;
