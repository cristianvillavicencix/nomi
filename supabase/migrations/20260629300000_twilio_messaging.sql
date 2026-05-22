-- Twilio SMS per organization + client conversation access.

create table if not exists public.organization_messaging_settings (
  org_id bigint primary key references public.organizations (id) on delete cascade,
  twilio_account_sid text,
  twilio_auth_token text,
  twilio_phone_number text,
  sms_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.organization_messaging_settings enable row level security;

grant all on public.organization_messaging_settings to service_role;

create index if not exists organization_messaging_settings_phone_idx
  on public.organization_messaging_settings (twilio_phone_number)
  where twilio_phone_number is not null;

create unique index if not exists conversations_client_phone_uidx
  on public.conversations (org_id, external_phone)
  where type = 'client' and external_phone is not null;

create or replace function public.user_can_access_conversation(conv_id bigint)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  allowed boolean;
begin
  perform set_config('row_security', 'off', true);

  select exists (
    select 1
    from public.conversations c
    where c.id = conv_id
      and c.org_id = public.current_user_org_id()
      and (
        c.type in ('project', 'client')
        or c.created_by_member_id = public.current_user_member_id()
        or public.is_conversation_participant(c.id, public.current_user_member_id())
      )
  )
  into allowed;

  return coalesce(allowed, false);
end;
$$;

drop policy if exists "conversations_access" on public.conversations;
create policy "conversations_access" on public.conversations
  for all to authenticated
  using (
    org_id = public.current_user_org_id()
    and (
      type in ('project', 'client')
      or created_by_member_id = public.current_user_member_id()
      or public.is_conversation_participant(id, public.current_user_member_id())
    )
  )
  with check (
    org_id = public.current_user_org_id()
    and (
      type in ('project', 'client')
      or created_by_member_id = public.current_user_member_id()
      or public.is_conversation_participant(id, public.current_user_member_id())
    )
  );

drop policy if exists "conversation_participants_access" on public.conversation_participants;
create policy "conversation_participants_access" on public.conversation_participants
  for all to authenticated
  using (
    member_id = public.current_user_member_id()
    or exists (
      select 1
      from public.conversations c
      where c.id = conversation_participants.conversation_id
        and c.org_id = public.current_user_org_id()
        and (
          c.type in ('project', 'client')
          or c.created_by_member_id = public.current_user_member_id()
        )
    )
  )
  with check (
    member_id = public.current_user_member_id()
    or exists (
      select 1
      from public.conversations c
      where c.id = conversation_participants.conversation_id
        and c.org_id = public.current_user_org_id()
        and (
          c.type in ('project', 'client')
          or c.created_by_member_id = public.current_user_member_id()
        )
    )
  );
