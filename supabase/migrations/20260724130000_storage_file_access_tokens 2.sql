-- Opaque public download tokens for private storage objects (emails, portal, forms).
-- Served via edge function file_download and www.nomicrm.com/files/:token rewrite.

create table if not exists public.storage_file_access_tokens (
  id bigint generated always as identity primary key,
  token text not null unique,
  bucket text not null,
  storage_path text not null,
  filename text not null,
  mime_type text,
  purpose text not null,
  org_id bigint references public.organizations (id) on delete set null,
  expires_at timestamptz not null,
  max_uses int,
  uses_count int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists storage_file_access_tokens_token_idx
  on public.storage_file_access_tokens (token);

create index if not exists storage_file_access_tokens_expires_idx
  on public.storage_file_access_tokens (expires_at);

alter table public.storage_file_access_tokens enable row level security;

comment on table public.storage_file_access_tokens is
  'Public download tokens for private storage files; validated by file_download edge function.';

-- No authenticated policies: only service_role creates/consumes tokens.
grant select, insert, update, delete on public.storage_file_access_tokens to service_role;
