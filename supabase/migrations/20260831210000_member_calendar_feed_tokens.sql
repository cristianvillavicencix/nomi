-- Secret per-member tokens for subscribing to Nomi calendar via iCal/WebCal.

create table if not exists public.member_calendar_feed_tokens (
  id bigint generated always as identity primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  organization_member_id bigint not null references public.organization_members (id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now(),
  last_fetched_at timestamptz,
  unique (organization_member_id)
);

create index if not exists member_calendar_feed_tokens_token_idx
  on public.member_calendar_feed_tokens (token);

alter table public.member_calendar_feed_tokens enable row level security;

grant select, insert, update, delete on public.member_calendar_feed_tokens to authenticated;
grant all on public.member_calendar_feed_tokens to service_role;

create policy "member_calendar_feed_tokens_select"
  on public.member_calendar_feed_tokens for select to authenticated
  using (
    org_id = public.current_user_org_id()
    and organization_member_id = public.current_user_member_id()
  );

create policy "member_calendar_feed_tokens_insert"
  on public.member_calendar_feed_tokens for insert to authenticated
  with check (
    org_id = public.current_user_org_id()
    and organization_member_id = public.current_user_member_id()
  );

create policy "member_calendar_feed_tokens_update"
  on public.member_calendar_feed_tokens for update to authenticated
  using (
    org_id = public.current_user_org_id()
    and organization_member_id = public.current_user_member_id()
  )
  with check (
    org_id = public.current_user_org_id()
    and organization_member_id = public.current_user_member_id()
  );

create policy "member_calendar_feed_tokens_delete"
  on public.member_calendar_feed_tokens for delete to authenticated
  using (
    org_id = public.current_user_org_id()
    and organization_member_id = public.current_user_member_id()
  );

comment on table public.member_calendar_feed_tokens is
  'Secret iCal/WebCal subscription tokens for organization members.';
