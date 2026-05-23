-- Website page content for LBS agency projects (Phase 6)

alter table public.deals
  add column if not exists website_content jsonb not null default '{"pages":[]}'::jsonb;

comment on column public.deals.website_content is
  'LBS: structured page content (copy, SEO, approvals) for website projects.';
