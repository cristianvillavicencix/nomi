-- Workspace controls for inbound lead automation (web hooks, forms).

alter table public.organizations
  add column if not exists lead_settings jsonb not null default jsonb_build_object(
    'auto_create_deal_from_web', false,
    'allow_form_auto_create_deal', false
  );

comment on column public.organizations.lead_settings is
  'Inbound lead automation: auto_create_deal_from_web (lbs.bz webhook), allow_form_auto_create_deal (form auto-create opportunity).';
