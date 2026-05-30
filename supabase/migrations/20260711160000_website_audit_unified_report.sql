-- Unified Web Report: one row = mobile + desktop snapshots (single PDF portal).

alter table public.website_audits
  drop constraint if exists website_audits_strategy_check;

alter table public.website_audits
  add constraint website_audits_strategy_check
  check (strategy in ('mobile', 'desktop', 'unified'));

alter table public.website_audits
  add column if not exists mobile_snapshot jsonb,
  add column if not exists desktop_snapshot jsonb;

comment on column public.website_audits.mobile_snapshot is
  'Lighthouse + axe lab bundle for mobile form factor (unified reports).';
comment on column public.website_audits.desktop_snapshot is
  'Lighthouse + axe lab bundle for desktop form factor (unified reports).';
