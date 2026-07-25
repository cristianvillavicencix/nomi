-- CRM Mail: OAuth CSRF state + FTS search helper + retention + sync cron support

create table if not exists public.mail_oauth_states (
  state text primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  member_id bigint not null references public.organization_members (id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft')),
  scope text not null check (scope in ('org', 'personal')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists mail_oauth_states_expires_idx
  on public.mail_oauth_states (expires_at);

alter table public.mail_oauth_states enable row level security;
-- No client policies: Edge service role only.

grant select, insert, update, delete on public.mail_oauth_states to service_role;

-- Full-text search RPC for Mail hub
create or replace function public.mail_search_threads(
  p_query text,
  p_account_id bigint default null,
  p_limit int default 50
)
returns setof public.mail_threads
language sql
stable
security invoker
as $$
  select t.*
  from public.mail_threads t
  where t.is_trashed = false
    and (p_account_id is null or t.account_id = p_account_id)
    and (
      p_query is null
      or length(trim(p_query)) = 0
      or t.search_document @@ plainto_tsquery('english', p_query)
      or t.subject ilike '%' || p_query || '%'
      or t.snippet ilike '%' || p_query || '%'
    )
  order by
    case
      when p_query is not null and length(trim(p_query)) > 0
        then ts_rank(t.search_document, plainto_tsquery('english', p_query))
      else 0
    end desc,
    t.last_message_at desc nulls last
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

grant execute on function public.mail_search_threads(text, bigint, int) to authenticated;

-- Retention: purge soft-trashed threads older than N days (default 90)
create or replace function public.mail_purge_trashed(p_older_than_days int default 90)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count int;
begin
  if auth.role() is distinct from 'service_role'
     and not coalesce(
       (select administrator from public.organization_members
        where user_id = auth.uid() limit 1),
       false
     )
  then
    raise exception 'not allowed';
  end if;

  with doomed as (
    delete from public.mail_threads
    where is_trashed = true
      and updated_at < now() - make_interval(days => greatest(p_older_than_days, 1))
    returning id
  )
  select count(*)::int into deleted_count from doomed;
  return deleted_count;
end;
$$;

revoke all on function public.mail_purge_trashed(int) from public;
grant execute on function public.mail_purge_trashed(int) to service_role;

-- Accounts due for sync (Edge cron / mail_sync batch)
create or replace function public.mail_accounts_due_for_sync(p_limit int default 20)
returns setof public.mail_accounts
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.mail_accounts
  where status = 'connected'
    and (
      last_sync_at is null
      or last_sync_at < now() - interval '5 minutes'
    )
  order by last_sync_at nulls first
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

revoke all on function public.mail_accounts_due_for_sync(int) from public;
grant execute on function public.mail_accounts_due_for_sync(int) to service_role;

comment on function public.mail_search_threads is
  'FTS + ilike fallback for CRM Mail thread list search.';
comment on function public.mail_purge_trashed is
  'Hard-delete trashed mail threads older than N days (ops / retention).';
