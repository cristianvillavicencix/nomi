-- Client portal: deal waits for deposit after signature (before project activation).

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
  'pending_payment',
  'Pending payment',
  '#eab308',
  35,
  false,
  false
from public.organizations o
on conflict (org_id, pipeline_id, key) do nothing;

-- Map pending_payment -> contact lead_stage closing (awaiting deposit).
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
    when 'won'              then 'won'
    when 'closed_won'       then 'won'
    when 'closed_lost'      then 'lost'
    when 'proposal_sent'    then 'quoted'
    when 'pending_payment'  then 'closing'
    when 'discovery'        then 'talking'
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
