-- Add short code support for client portal invite links.

alter table public.client_portal_accounts
  add column if not exists short_code text;

create unique index if not exists client_portal_accounts_short_code_uidx
  on public.client_portal_accounts (short_code)
  where short_code is not null;

