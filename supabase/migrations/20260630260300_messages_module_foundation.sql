-- Messages module foundation: templates, conversation metadata, internal notes, voice shell, settings.

-- ---------------------------------------------------------------------------
-- message_templates
-- ---------------------------------------------------------------------------
create table if not exists public.message_templates (
  id bigint generated always as identity primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  name text not null,
  category text,
  language text not null default 'es' check (language in ('en', 'es')),
  body text not null,
  variables text[] not null default '{}',
  channels text[] not null default '{sms}',
  created_by_member_id bigint references public.organization_members (id) on delete set null,
  is_archived boolean not null default false,
  use_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_message_templates_org
  on public.message_templates (org_id)
  where not is_archived;

alter table public.message_templates enable row level security;

grant select, insert, update, delete on public.message_templates to authenticated;
grant all on public.message_templates to service_role;

drop policy if exists "message_templates_select" on public.message_templates;
create policy "message_templates_select" on public.message_templates
  for select to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('messaging.templates.view')
  );

drop policy if exists "message_templates_insert" on public.message_templates;
create policy "message_templates_insert" on public.message_templates
  for insert to authenticated
  with check (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('messaging.templates.manage')
  );

drop policy if exists "message_templates_update" on public.message_templates;
create policy "message_templates_update" on public.message_templates
  for update to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('messaging.templates.manage')
  )
  with check (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('messaging.templates.manage')
  );

drop policy if exists "message_templates_delete" on public.message_templates;
create policy "message_templates_delete" on public.message_templates
  for delete to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('messaging.templates.manage')
  );

-- ---------------------------------------------------------------------------
-- conversations: assignment, status, tags
-- ---------------------------------------------------------------------------
alter table public.conversations
  add column if not exists assignee_member_id bigint references public.organization_members (id) on delete set null,
  add column if not exists status text not null default 'open',
  add column if not exists tags text[] not null default '{}',
  add column if not exists priority text not null default 'normal',
  add column if not exists first_response_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by_member_id bigint references public.organization_members (id) on delete set null;

alter table public.conversations drop constraint if exists conversations_status_check;
alter table public.conversations
  add constraint conversations_status_check
  check (status in ('open', 'pending', 'closed', 'urgent'));

alter table public.conversations drop constraint if exists conversations_priority_check;
alter table public.conversations
  add constraint conversations_priority_check
  check (priority in ('low', 'normal', 'high', 'urgent'));

create index if not exists idx_conversations_assignee
  on public.conversations (assignee_member_id)
  where assignee_member_id is not null;

create index if not exists idx_conversations_status
  on public.conversations (org_id, status);

create index if not exists idx_conversations_tags
  on public.conversations using gin (tags);

-- ---------------------------------------------------------------------------
-- conversation_messages: internal notes, replies, soft delete
-- ---------------------------------------------------------------------------
alter table public.conversation_messages
  add column if not exists is_internal_note boolean not null default false,
  add column if not exists reply_to_message_id bigint references public.conversation_messages (id) on delete set null,
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz;

create index if not exists idx_messages_thread
  on public.conversation_messages (conversation_id, created_at)
  where deleted_at is null;

create index if not exists idx_messages_external_id
  on public.conversation_messages (external_id)
  where external_id is not null;

-- Hide soft-deleted messages from authenticated users
drop policy if exists "conversation_messages_access" on public.conversation_messages;
create policy "conversation_messages_access" on public.conversation_messages
  for all to authenticated
  using (
    deleted_at is null
    and public.user_can_access_conversation(conversation_id)
  )
  with check (
    deleted_at is null
    and public.user_can_access_conversation(conversation_id)
    and (
      author_member_id is null
      or (
        author_member_id = public.current_user_member_id()
        and (
          is_internal_note = true
            and public.current_member_has_capability('messaging.internal_notes.write')
          or (
            is_internal_note = false
            and public.current_member_has_capability('messaging.send')
          )
        )
      )
    )
  );

-- ---------------------------------------------------------------------------
-- voice_calls (shell)
-- ---------------------------------------------------------------------------
create table if not exists public.voice_calls (
  id bigint generated always as identity primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  external_id text,
  direction text not null check (direction in ('inbound', 'outbound')),
  status text not null default 'queued' check (
    status in (
      'queued',
      'ringing',
      'in-progress',
      'completed',
      'failed',
      'no-answer',
      'busy',
      'canceled'
    )
  ),
  from_number text,
  to_number text,
  contact_id bigint references public.contacts (id) on delete set null,
  deal_id bigint references public.deals (id) on delete set null,
  member_id bigint references public.organization_members (id) on delete set null,
  conversation_id bigint references public.conversations (id) on delete set null,
  duration_seconds integer,
  recording_url text,
  recording_enabled boolean not null default false,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_voice_calls_org
  on public.voice_calls (org_id, created_at desc);

create index if not exists idx_voice_calls_contact
  on public.voice_calls (contact_id);

create index if not exists idx_voice_calls_deal
  on public.voice_calls (deal_id);

create index if not exists idx_voice_calls_member
  on public.voice_calls (member_id);

alter table public.voice_calls enable row level security;

grant select on public.voice_calls to authenticated;
grant all on public.voice_calls to service_role;

create or replace function public.can_view_voice_call(p_call_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select id, administrator, org_id
    from public.organization_members
    where user_id = auth.uid()
    limit 1
  ),
  call_row as (
    select * from public.voice_calls where id = p_call_id
  )
  select case
    when not exists (select 1 from me) then false
    when not exists (select 1 from call_row) then false
    when (select org_id from call_row) <> (select org_id from me) then false
    when (select administrator from me) then true
    when not public.current_member_is_scoped_user() then true
    when (select member_id from call_row) = (select id from me) then true
    when (select deal_id from call_row) is not null
      and public.can_view_deal((select deal_id from call_row))
    then true
    when exists (
      select 1
      from public.record_shares rs
      where rs.resource_type = 'voice_calls'
        and rs.resource_id = p_call_id
        and rs.member_id = (select id from me)
    ) then true
    else false
  end;
$$;

grant execute on function public.can_view_voice_call(bigint) to authenticated;

drop policy if exists "voice_calls_select" on public.voice_calls;
create policy "voice_calls_select" on public.voice_calls
  for select to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.can_view_voice_call(id)
    and public.current_member_has_capability('voice.calls.view')
  );

-- ---------------------------------------------------------------------------
-- organization_messaging_settings extensions
-- ---------------------------------------------------------------------------
alter table public.organization_messaging_settings
  add column if not exists whatsapp_enabled boolean not null default false,
  add column if not exists whatsapp_business_account_id text,
  add column if not exists whatsapp_phone_number_id text,
  add column if not exists whatsapp_access_token_encrypted text,
  add column if not exists whatsapp_verify_token text,
  add column if not exists voice_enabled boolean not null default false,
  add column if not exists voice_twiml_app_sid text,
  add column if not exists voice_api_key_sid text,
  add column if not exists voice_api_key_secret_encrypted text,
  add column if not exists voice_caller_id text,
  add column if not exists voice_recording_default boolean not null default false,
  add column if not exists business_hours jsonb,
  add column if not exists out_of_hours_message text,
  add column if not exists auto_acknowledge_enabled boolean not null default false,
  add column if not exists auto_acknowledge_message text;
