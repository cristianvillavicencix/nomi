-- Shrink website pipeline: 12 → 9 stages (lazy Build = development).
-- Remap: discovery→lead, pending_payment→won, design→development.

-- 1) Remap deal stages
update public.deals
set stage = case stage
  when 'discovery' then 'lead'
  when 'pending_payment' then 'won'
  when 'design' then 'development'
  when 'qualified' then 'lead'
  when 'scheduled' then 'development'
  else stage
end
where stage in (
  'discovery',
  'pending_payment',
  'design',
  'qualified',
  'scheduled'
);

-- 2) Refresh lifecycle_phase for remapped / all open rows
update public.deals
set lifecycle_phase = case
  when stage in ('lead', 'proposal_sent') then 'opportunity'
  when stage in ('closed_won', 'closed_lost') then 'closed'
  else 'delivery'
end
where archived_at is null
  or stage in ('lead', 'proposal_sent', 'won', 'development', 'review', 'launch', 'maintenance', 'closed_won', 'closed_lost');

-- 3) Refresh delivery_status defaults where stage moved into delivery
update public.deals
set delivery_status = case stage
  when 'won' then coalesce(nullif(delivery_status, ''), 'planning')
  when 'development' then case
    when delivery_status in ('in_design', 'planning') or delivery_status is null or delivery_status = ''
      then 'in_development'
    else delivery_status
  end
  when 'review' then coalesce(nullif(delivery_status, ''), 'client_review')
  when 'launch' then coalesce(nullif(delivery_status, ''), 'ready_to_launch')
  when 'maintenance' then coalesce(nullif(delivery_status, ''), 'launched')
  when 'closed_won' then coalesce(nullif(delivery_status, ''), 'completed')
  else delivery_status
end
where stage in ('won', 'development', 'review', 'launch', 'maintenance', 'closed_won');

-- 4) Drop killed org pipeline columns
delete from public.organization_pipeline_stages
where key in ('discovery', 'pending_payment', 'design');

-- 5) Relabel + reindex remaining stages (all orgs / pipelines)
update public.organization_pipeline_stages
set
  label = case key
    when 'lead' then 'Lead'
    when 'proposal_sent' then 'Proposal'
    when 'won' then 'Won'
    when 'development' then 'Build'
    when 'review' then 'Review'
    when 'launch' then 'Launch'
    when 'maintenance' then 'Maintenance'
    when 'closed_won' then 'Closed'
    when 'closed_lost' then 'Lost'
    else label
  end,
  order_index = case key
    when 'lead' then 10
    when 'proposal_sent' then 20
    when 'won' then 30
    when 'development' then 40
    when 'review' then 50
    when 'launch' then 60
    when 'maintenance' then 70
    when 'closed_won' then 80
    when 'closed_lost' then 90
    else order_index
  end,
  is_won = (key in ('won', 'closed_won')),
  is_lost = (key = 'closed_lost'),
  color = case key
    when 'lead' then '#64748b'
    when 'proposal_sent' then '#f59e0b'
    when 'won' then '#16a34a'
    when 'development' then '#6366f1'
    when 'review' then '#f97316'
    when 'launch' then '#0d9488'
    when 'maintenance' then '#06b6d4'
    when 'closed_won' then '#0f766e'
    when 'closed_lost' then '#dc2626'
    else color
  end
where key in (
  'lead',
  'proposal_sent',
  'won',
  'development',
  'review',
  'launch',
  'maintenance',
  'closed_won',
  'closed_lost'
);

-- Ensure all orgs have the 9-stage set (insert missing keys)
insert into public.organization_pipeline_stages (
  org_id,
  pipeline_id,
  key,
  label,
  color,
  order_index,
  is_won,
  is_lost
)
select
  o.id,
  'default',
  s.key,
  s.label,
  s.color,
  s.order_index,
  s.is_won,
  s.is_lost
from public.organizations o
cross join (
  values
    ('lead', 'Lead', '#64748b', 10, false, false),
    ('proposal_sent', 'Proposal', '#f59e0b', 20, false, false),
    ('won', 'Won', '#16a34a', 30, true, false),
    ('development', 'Build', '#6366f1', 40, false, false),
    ('review', 'Review', '#f97316', 50, false, false),
    ('launch', 'Launch', '#0d9488', 60, false, false),
    ('maintenance', 'Maintenance', '#06b6d4', 70, false, false),
    ('closed_won', 'Closed', '#0f766e', 80, true, false),
    ('closed_lost', 'Lost', '#dc2626', 90, false, true)
) as s(key, label, color, order_index, is_won, is_lost)
on conflict (org_id, pipeline_id, key) do update
set
  label = excluded.label,
  color = excluded.color,
  order_index = excluded.order_index,
  is_won = excluded.is_won,
  is_lost = excluded.is_lost;

-- 6) Patch configuration JSON (Settings / CRM config)
update public.configuration
set config = config || jsonb_build_object(
  'dealStages', jsonb_build_array(
    jsonb_build_object('value', 'lead', 'label', 'Lead'),
    jsonb_build_object('value', 'proposal_sent', 'label', 'Proposal'),
    jsonb_build_object('value', 'won', 'label', 'Won'),
    jsonb_build_object('value', 'development', 'label', 'Build'),
    jsonb_build_object('value', 'review', 'label', 'Review'),
    jsonb_build_object('value', 'launch', 'label', 'Launch'),
    jsonb_build_object('value', 'maintenance', 'label', 'Maintenance'),
    jsonb_build_object('value', 'closed_won', 'label', 'Closed'),
    jsonb_build_object('value', 'closed_lost', 'label', 'Lost')
  ),
  'dealPipelines', jsonb_build_array(
    jsonb_build_object(
      'id', 'default',
      'label', 'Default Board',
      'order', 1,
      'isDefault', true,
      'stages', jsonb_build_array(
        jsonb_build_object('id', 'lead', 'label', 'Lead', 'color', '#64748b', 'order', 1, 'pipelineId', 'default', 'isDefault', true),
        jsonb_build_object('id', 'proposal_sent', 'label', 'Proposal', 'color', '#f59e0b', 'order', 2, 'pipelineId', 'default', 'isDefault', false),
        jsonb_build_object('id', 'won', 'label', 'Won', 'color', '#16a34a', 'order', 3, 'pipelineId', 'default', 'isDefault', false),
        jsonb_build_object('id', 'development', 'label', 'Build', 'color', '#6366f1', 'order', 4, 'pipelineId', 'default', 'isDefault', false),
        jsonb_build_object('id', 'review', 'label', 'Review', 'color', '#f97316', 'order', 5, 'pipelineId', 'default', 'isDefault', false),
        jsonb_build_object('id', 'launch', 'label', 'Launch', 'color', '#0d9488', 'order', 6, 'pipelineId', 'default', 'isDefault', false),
        jsonb_build_object('id', 'maintenance', 'label', 'Maintenance', 'color', '#06b6d4', 'order', 7, 'pipelineId', 'default', 'isDefault', false),
        jsonb_build_object('id', 'closed_won', 'label', 'Closed', 'color', '#0f766e', 'order', 8, 'pipelineId', 'default', 'isDefault', false),
        jsonb_build_object('id', 'closed_lost', 'label', 'Lost', 'color', '#dc2626', 'order', 9, 'pipelineId', 'default', 'isDefault', false)
      )
    )
  )
);

-- 7) Contact lead_stage sync: drop dead pending_payment / discovery branches
create or replace function public.sync_deal_stage_to_contact_lead_stage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_lead_stage text;
  v_should_freeze     boolean;
begin
  if new.contact_id is null then
    return new;
  end if;

  if TG_OP = 'UPDATE' and new.stage is not distinct from old.stage then
    return new;
  end if;

  v_target_lead_stage := case new.stage
    when 'won'           then 'won'
    when 'closed_won'    then 'won'
    when 'closed_lost'   then 'lost'
    when 'proposal_sent' then 'quoted'
    else null
  end;

  v_should_freeze := new.stage in ('won', 'closed_won', 'closed_lost');

  update public.contacts c
  set
    lead_stage = coalesce(v_target_lead_stage, c.lead_stage),
    snooze_until = case
      when v_should_freeze then '2099-12-31 00:00:00+00'::timestamptz
      else c.snooze_until
    end
  where c.id = new.contact_id
    and (
      (v_target_lead_stage is not null
       and c.lead_stage is distinct from v_target_lead_stage)
      or (v_should_freeze
          and c.snooze_until is distinct from '2099-12-31 00:00:00+00'::timestamptz)
    );

  return new;
end;
$$;
