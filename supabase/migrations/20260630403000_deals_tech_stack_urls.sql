alter table public.deals
  add column if not exists tech_stack jsonb not null default '[]'::jsonb,
  add column if not exists staging_url text,
  add column if not exists production_url text;

comment on column public.deals.tech_stack is
  'LBS: tags for technologies used on the project (React, WordPress, etc.).';
comment on column public.deals.staging_url is 'LBS: staging/preview URL for client review.';
comment on column public.deals.production_url is 'LBS: live production URL after launch.';
