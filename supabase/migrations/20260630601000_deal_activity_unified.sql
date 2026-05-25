-- Unified project activity feed with author attribution (scoped via underlying RLS).

create or replace view public.deal_activity_unified
with (security_invoker = true)
as
select
  (activity_type || ':' || activity_id) as id,
  activity_type,
  activity_id,
  deal_id,
  member_id,
  description,
  created_at,
  org_id
from (
  select
    'message'::text as activity_type,
  cm.id::text as activity_id,
  c.deal_id,
  cm.author_member_id as member_id,
  'sent message: "' || left(cm.body, 60)
    || case when length(cm.body) > 60 then '...' else '' end
    || '"' as description,
  cm.created_at,
  c.org_id
from public.conversation_messages cm
join public.conversations c on c.id = cm.conversation_id
where c.deal_id is not null
  and cm.deleted_at is null
  and cm.direction = 'outbound'
  and coalesce(cm.is_internal_note, false) = false

union all

select
  'note'::text,
  dn.id::text,
  dn.deal_id,
  dn.organization_member_id,
  'added note: "' || left(dn.text, 60)
    || case when length(dn.text) > 60 then '...' else '' end
    || '"',
  dn.date,
  d.org_id
from public.deal_notes dn
join public.deals d on d.id = dn.deal_id

union all

select
  'expense'::text,
  de.id::text,
  de.deal_id,
  de.created_by_member_id,
  'added expense: ' || coalesce(de.description, de.expense_type, 'expense')
    || ' ($' || de.amount::text || ')',
  de.created_at,
  d.org_id
from public.deal_expenses de
join public.deals d on d.id = de.deal_id

union all

select
  'change_order'::text,
  dco.id::text,
  dco.deal_id,
  dco.created_by_member_id,
  'created change order: ' || dco.title || ' ($' || dco.amount::text || ')',
  dco.created_at,
  d.org_id
from public.deal_change_orders dco
join public.deals d on d.id = dco.deal_id

union all

select
  'payment'::text,
  dcp.id::text,
  dcp.deal_id,
  dcp.created_by_member_id,
  'recorded payment: $' || dcp.amount::text,
  dcp.created_at,
  d.org_id
from public.deal_client_payments dcp
join public.deals d on d.id = dcp.deal_id

union all

select
  'task_created'::text,
  t.id::text,
  t.deal_id,
  t.organization_member_id,
  'created task: "' || t.text || '"',
  t.created_at,
  d.org_id
from public.tasks t
join public.deals d on d.id = t.deal_id
where t.deal_id is not null
) unified;

grant select on public.deal_activity_unified to authenticated;
