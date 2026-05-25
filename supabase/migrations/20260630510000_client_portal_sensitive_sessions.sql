-- Short-lived sensitive sessions for client portal credential access (5 min TTL).

create table if not exists public.client_portal_sensitive_sessions (
  id bigint generated always as identity primary key,
  portal_account_id bigint not null references public.client_portal_accounts (id) on delete cascade,
  session_token text not null unique,
  expires_at timestamptz not null,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists client_portal_sensitive_sessions_account_idx
  on public.client_portal_sensitive_sessions (portal_account_id, expires_at desc);

create index if not exists client_portal_sensitive_sessions_expires_idx
  on public.client_portal_sensitive_sessions (expires_at);

alter table public.client_portal_sensitive_sessions enable row level security;

grant all on public.client_portal_sensitive_sessions to service_role;

-- Team can inspect active sessions for support (read-only).
create policy "client_portal_sensitive_sessions_team_select"
  on public.client_portal_sensitive_sessions for select to authenticated
  using (
    exists (
      select 1
      from public.client_portal_accounts cpa
      where cpa.id = portal_account_id
        and cpa.org_id = public.current_user_org_id()
    )
    and public.current_member_has_capability('crm.pipeline.edit')
  );

-- Purge expired sessions (optional cron; safe to run manually).
create or replace function public.purge_expired_portal_sensitive_sessions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.client_portal_sensitive_sessions
  where expires_at < now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.purge_expired_portal_sensitive_sessions() from public, authenticated;
grant execute on function public.purge_expired_portal_sensitive_sessions() to service_role;
