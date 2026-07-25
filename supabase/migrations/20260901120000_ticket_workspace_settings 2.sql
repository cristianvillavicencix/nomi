-- Org-wide ticket workspace settings + per-inbox automation fields.

alter table public.organizations
  add column if not exists ticket_settings jsonb not null default '{}'::jsonb;

comment on column public.organizations.ticket_settings is
  'Org ticket defaults: assignee, notifications, workflow, billing, spam, SLA, macros, round-robin, CSAT.';

alter table public.ticket_inboxes
  add column if not exists auto_reply_enabled boolean not null default true,
  add column if not exists auto_reply_subject text,
  add column if not exists auto_reply_html text,
  add column if not exists auto_reply_text text,
  add column if not exists create_templates jsonb not null default '[]'::jsonb,
  add column if not exists disabled_builtin_reply_template_ids text[] not null default '{}',
  add column if not exists is_default boolean not null default false,
  add column if not exists last_inbound_at timestamptz;

comment on column public.ticket_inboxes.auto_reply_enabled is
  'Send automatic acknowledgement when a new ticket is created from inbound email.';
comment on column public.ticket_inboxes.create_templates is
  'Templates for the manual new-ticket composer: [{ id, label, description?, body }].';
comment on column public.ticket_inboxes.disabled_builtin_reply_template_ids is
  'Built-in reply template ids hidden from the composer for this inbox.';
comment on column public.ticket_inboxes.is_default is
  'Default inbox when creating tickets manually (one per org).';
comment on column public.ticket_inboxes.last_inbound_at is
  'Last inbound client message received for this inbox (health).';

alter table public.tickets
  add column if not exists tags text[] not null default '{}';

create index if not exists tickets_tags_gin_idx on public.tickets using gin (tags);

-- One default inbox per org
create unique index if not exists ticket_inboxes_one_default_per_org_idx
  on public.ticket_inboxes (org_id)
  where is_default = true;

-- Mark first inbox per org as default where none set
update public.ticket_inboxes ti
set is_default = true
where not exists (
  select 1
  from public.ticket_inboxes other
  where other.org_id = ti.org_id
    and other.is_default = true
)
and ti.id = (
  select min(ti2.id)
  from public.ticket_inboxes ti2
  where ti2.org_id = ti.org_id
);

grant insert on public.ticket_inboxes to authenticated;

create policy "ticket_inboxes_insert_org" on public.ticket_inboxes
  for insert to authenticated
  with check (
    org_id = public.current_user_org_id()
    and (
      public.current_member_has_capability('admin.settings.manage')
      or public.current_member_has_capability('support.tickets.manage')
    )
  );

-- Touch last_inbound_at when inbound messages arrive
create or replace function public.trg_ticket_inbox_touch_last_inbound()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inbox_email text;
  v_org_id bigint;
begin
  if new.direction is distinct from 'inbound' then
    return new;
  end if;

  select t.org_id, t.inbox_address
  into v_org_id, v_inbox_email
  from public.tickets t
  where t.id = new.ticket_id;

  if v_org_id is null or v_inbox_email is null or btrim(v_inbox_email) = '' then
    return new;
  end if;

  update public.ticket_inboxes
  set last_inbound_at = coalesce(new.created_at, now())
  where org_id = v_org_id
    and lower(email) = lower(v_inbox_email);

  return new;
end;
$$;

drop trigger if exists trg_ticket_inbox_touch_last_inbound on public.ticket_messages;

create trigger trg_ticket_inbox_touch_last_inbound
  after insert on public.ticket_messages
  for each row
  execute function public.trg_ticket_inbox_touch_last_inbound();
