-- Mark Hostinger domains owned by the organization (not client domains).

alter table public.hostinger_domains
  add column if not exists is_owned boolean not null default false;

create index if not exists hostinger_domains_org_owned_idx
  on public.hostinger_domains (org_id, is_owned)
  where is_owned = true;

comment on column public.hostinger_domains.is_owned is
  'True when the domain belongs to the organization itself, not a client.';
