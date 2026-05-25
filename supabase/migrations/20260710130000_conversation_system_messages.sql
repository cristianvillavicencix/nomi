-- System messages in project conversations.
--
-- Adds a `kind` discriminator on conversation_messages and ships triggers that
-- post short "system" entries to the project chat whenever common operational
-- events happen (project creation, stage/delivery status change, team
-- assignment, file upload, task creation). System rows have author_member_id
-- NULL and kind='system', so the UI can render them as centred grey notes.
--
-- Triggers are no-ops when the actor is not an authenticated member (e.g.
-- service-role/backfill writes), which keeps automation, migrations, and
-- imports from spamming the inbox.

-- ---------------------------------------------------------------------------
-- 1. Schema: kind column + backfill from is_internal_note.
-- ---------------------------------------------------------------------------
alter table public.conversation_messages
  add column if not exists kind text not null default 'user';

alter table public.conversation_messages
  drop constraint if exists conversation_messages_kind_check;

alter table public.conversation_messages
  add constraint conversation_messages_kind_check
  check (kind in ('user', 'system', 'internal_note'));

update public.conversation_messages
set kind = 'internal_note'
where is_internal_note = true
  and kind = 'user';

-- ---------------------------------------------------------------------------
-- 2. Helpers.
-- ---------------------------------------------------------------------------
create or replace function public.member_display_name(p_member_id bigint)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(btrim(coalesce(om.first_name, '') || ' ' || coalesce(om.last_name, '')), ''),
    om.email,
    'Someone'
  )
  from public.organization_members om
  where om.id = p_member_id
  limit 1;
$$;

grant execute on function public.member_display_name(bigint) to authenticated;

create or replace function public.post_project_system_message(
  p_deal_id bigint,
  p_body text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv_id bigint;
  v_org_id bigint;
  v_deal_name text;
begin
  if p_deal_id is null then return null; end if;
  if p_body is null or btrim(p_body) = '' then return null; end if;

  select id into v_conv_id
  from public.conversations
  where deal_id = p_deal_id and type = 'project'
  limit 1;

  if v_conv_id is null then
    select org_id, name into v_org_id, v_deal_name
    from public.deals
    where id = p_deal_id
    limit 1;

    if v_org_id is null then return null; end if;

    insert into public.conversations (
      org_id,
      type,
      deal_id,
      title,
      created_by_member_id
    )
    values (
      v_org_id,
      'project',
      p_deal_id,
      coalesce(nullif(btrim(v_deal_name), ''), 'Project team chat'),
      null
    )
    returning id into v_conv_id;
  end if;

  insert into public.conversation_messages (
    conversation_id,
    author_member_id,
    body,
    channel,
    direction,
    kind
  ) values (
    v_conv_id,
    null,
    p_body,
    'internal',
    'outbound',
    'system'
  );

  return v_conv_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Triggers on deals.
-- ---------------------------------------------------------------------------
create or replace function public.trg_deals_system_create_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id bigint := public.current_user_member_id();
begin
  if v_actor_id is null then return new; end if;
  perform public.post_project_system_message(
    new.id,
    coalesce(public.member_display_name(v_actor_id), 'Someone')
      || ' created this project'
  );
  return new;
end;
$$;

drop trigger if exists trg_deals_system_create_log on public.deals;
create trigger trg_deals_system_create_log
  after insert on public.deals
  for each row execute function public.trg_deals_system_create_log();

create or replace function public.trg_deals_system_stage_change_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id bigint := public.current_user_member_id();
begin
  if v_actor_id is null then return new; end if;
  if new.stage is not distinct from old.stage then return new; end if;
  perform public.post_project_system_message(
    new.id,
    coalesce(public.member_display_name(v_actor_id), 'Someone')
      || ' changed the stage to "' || coalesce(new.stage, 'none') || '"'
  );
  return new;
end;
$$;

drop trigger if exists trg_deals_system_stage_change_log on public.deals;
create trigger trg_deals_system_stage_change_log
  after update of stage on public.deals
  for each row execute function public.trg_deals_system_stage_change_log();

create or replace function public.trg_deals_system_delivery_status_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id bigint := public.current_user_member_id();
begin
  if v_actor_id is null then return new; end if;
  if new.delivery_status is not distinct from old.delivery_status then return new; end if;
  perform public.post_project_system_message(
    new.id,
    coalesce(public.member_display_name(v_actor_id), 'Someone')
      || ' marked delivery as "'
      || coalesce(new.delivery_status, 'pending')
      || '"'
  );
  return new;
end;
$$;

drop trigger if exists trg_deals_system_delivery_status_log on public.deals;
create trigger trg_deals_system_delivery_status_log
  after update of delivery_status on public.deals
  for each row execute function public.trg_deals_system_delivery_status_log();

create or replace function public.trg_deals_system_team_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id bigint := public.current_user_member_id();
  v_actor_name text;
  v_added bigint;
begin
  if v_actor_id is null then return new; end if;
  if new.salesperson_ids is not distinct from old.salesperson_ids then return new; end if;
  v_actor_name := coalesce(public.member_display_name(v_actor_id), 'Someone');

  for v_added in
    select added.member_id
    from (
      select unnest(coalesce(new.salesperson_ids, array[]::bigint[])) as member_id
      except
      select unnest(coalesce(old.salesperson_ids, array[]::bigint[]))
    ) added
  loop
    perform public.post_project_system_message(
      new.id,
      v_actor_name
        || ' added '
        || coalesce(public.member_display_name(v_added), 'a team member')
        || ' to the project'
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_deals_system_team_log on public.deals;
create trigger trg_deals_system_team_log
  after update of salesperson_ids on public.deals
  for each row execute function public.trg_deals_system_team_log();

-- ---------------------------------------------------------------------------
-- 4. Triggers on deal_resources (file uploads).
-- ---------------------------------------------------------------------------
create or replace function public.trg_deal_resources_system_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id bigint := public.current_user_member_id();
  v_label text;
begin
  if v_actor_id is null then return new; end if;
  if new.deal_id is null then return new; end if;
  v_label := coalesce(nullif(btrim(new.label), ''), 'a file');
  perform public.post_project_system_message(
    new.deal_id,
    coalesce(public.member_display_name(v_actor_id), 'Someone')
      || ' uploaded "' || v_label || '"'
  );
  return new;
end;
$$;

drop trigger if exists trg_deal_resources_system_log on public.deal_resources;
create trigger trg_deal_resources_system_log
  after insert on public.deal_resources
  for each row execute function public.trg_deal_resources_system_log();

-- ---------------------------------------------------------------------------
-- 5. Triggers on tasks (creation).
-- ---------------------------------------------------------------------------
create or replace function public.trg_tasks_system_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id bigint := public.current_user_member_id();
  v_label text;
begin
  if v_actor_id is null then return new; end if;
  if new.deal_id is null then return new; end if;
  v_label := coalesce(nullif(btrim(new.text), ''), 'untitled');
  perform public.post_project_system_message(
    new.deal_id,
    coalesce(public.member_display_name(v_actor_id), 'Someone')
      || ' created task: ' || v_label
  );
  return new;
end;
$$;

drop trigger if exists trg_tasks_system_log on public.tasks;
create trigger trg_tasks_system_log
  after insert on public.tasks
  for each row execute function public.trg_tasks_system_log();
