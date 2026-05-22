-- CRM member @ mentions + migrate legacy task assignments into description text

alter table public.tasks
  add column if not exists mentioned_member_ids bigint[] not null default '{}';

create index if not exists tasks_mentioned_member_ids_idx
  on public.tasks using gin (mentioned_member_ids);

alter table public.task_tag_notifications
  alter column person_id drop not null;

alter table public.task_tag_notifications
  drop constraint if exists task_tag_notifications_task_id_person_id_recipient_organization_member_id_key;

create unique index if not exists task_tag_notifications_person_tag_uidx
  on public.task_tag_notifications (task_id, person_id, recipient_organization_member_id)
  where person_id is not null;

create unique index if not exists task_tag_notifications_member_tag_uidx
  on public.task_tag_notifications (task_id, recipient_organization_member_id)
  where person_id is null;

create or replace function public.build_task_person_mention_token(person_id bigint)
returns text
language sql
stable
set search_path = public
as $$
  select '@[' || trim(both from coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')) || '](person:' || p.id || ')'
  from public.people p
  where p.id = person_id;
$$;

create or replace function public.build_task_member_mention_token(member_id bigint)
returns text
language sql
stable
set search_path = public
as $$
  select '@[' || trim(both from coalesce(om.first_name, '') || ' ' || coalesce(om.last_name, '')) || '](member:' || om.id || ')'
  from public.organization_members om
  where om.id = member_id;
$$;

create or replace function public.migrate_legacy_task_mentions()
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  updated_count integer := 0;
  task_row record;
  mention_tokens text := '';
  person_id bigint;
  member_ids bigint[] := '{}';
  original_text text;
  has_existing_mentions boolean;
begin
  for task_row in
    select
      t.id,
      t.text,
      t.organization_member_id,
      coalesce(t.assignee_person_ids, '{}'::bigint[]) as assignee_person_ids,
      coalesce(t.collaborator_person_ids, '{}'::bigint[]) as collaborator_person_ids
    from public.tasks t
  loop
    original_text := coalesce(task_row.text, '');
    has_existing_mentions := original_text ~ '@\[[^\]]+\]\((person|member):\d+\)';

    if has_existing_mentions then
      continue;
    end if;

    mention_tokens := '';

    foreach person_id in array task_row.assignee_person_ids loop
      mention_tokens := trim(both from concat_ws(
        ' ',
        mention_tokens,
        public.build_task_person_mention_token(person_id)
      ));
    end loop;

    foreach person_id in array task_row.collaborator_person_ids loop
      if person_id = any(task_row.assignee_person_ids) then
        continue;
      end if;
      mention_tokens := trim(both from concat_ws(
        ' ',
        mention_tokens,
        public.build_task_person_mention_token(person_id)
      ));
    end loop;

    if mention_tokens = '' and task_row.organization_member_id is not null then
      mention_tokens := public.build_task_member_mention_token(task_row.organization_member_id);
      member_ids := array[task_row.organization_member_id];
    end if;

    if mention_tokens = '' then
      continue;
    end if;

    update public.tasks
    set
      text = case
        when original_text = '' then mention_tokens
        else mention_tokens || ' — ' || original_text
      end,
      mentioned_member_ids = case
        when coalesce(array_length(member_ids, 1), 0) > 0 then member_ids
        else mentioned_member_ids
      end
    where id = task_row.id;

    updated_count := updated_count + 1;
  end loop;

  return updated_count;
end;
$fn$;

select public.migrate_legacy_task_mentions();
