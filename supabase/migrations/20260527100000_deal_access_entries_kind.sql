-- Add credential kind to drive UI (login vs api_key, etc.)

alter table public.deal_access_entries
  add column if not exists kind text not null default 'login'
    check (kind in ('login', 'api_key', 'link', 'note')),
  add column if not exists secret_label text;

-- Backfill based on existing label conventions.
update public.deal_access_entries
set
  kind = 'api_key',
  secret_label = coalesce(secret_label, 'API key')
where kind = 'login'
  and label ilike '%api key%';

