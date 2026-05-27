-- Allow sharing API keys/secrets with client portal and audit access.

alter table public.deal_secrets
  add column if not exists shared_with_client boolean not null default true;

alter table public.client_credential_access_log
  add column if not exists secret_id bigint references public.deal_secrets (id) on delete set null;

-- Backfill: keep existing access-entry logs intact; only secrets will use secret_id going forward.

