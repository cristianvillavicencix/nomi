-- Hostinger referral / affiliate purchase link settings.

alter table public.organization_hostinger_settings
  add column if not exists referral_code text,
  add column if not exists referral_link_template text;

comment on column public.organization_hostinger_settings.referral_code is
  'Affiliate or referral code appended to public Hostinger purchase links.';

comment on column public.organization_hostinger_settings.referral_link_template is
  'Optional purchase URL template. Placeholders: {domain}, {code}.';
