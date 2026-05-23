-- LBS agency project lifecycle: separate sales/delivery semantics on deals (no new projects table)

alter table public.deals
  add column if not exists lifecycle_phase text not null default 'delivery',
  add column if not exists delivery_status text,
  add column if not exists accepted_proposal_id bigint references public.proposals (id) on delete set null,
  add column if not exists priority text not null default 'normal';

alter table public.deals drop constraint if exists deals_lifecycle_phase_check;
alter table public.deals
  add constraint deals_lifecycle_phase_check
  check (lifecycle_phase in ('opportunity', 'delivery', 'closed'));

alter table public.deals drop constraint if exists deals_delivery_status_check;
alter table public.deals
  add constraint deals_delivery_status_check
  check (
    delivery_status is null
    or delivery_status in (
      'planning',
      'waiting_client',
      'in_design',
      'in_development',
      'internal_review',
      'client_review',
      'revisions',
      'ready_to_launch',
      'launched',
      'completed',
      'on_hold',
      'cancelled'
    )
  );

alter table public.deals drop constraint if exists deals_priority_check;
alter table public.deals
  add constraint deals_priority_check
  check (priority in ('low', 'normal', 'high', 'urgent'));

create index if not exists deals_lifecycle_phase_idx on public.deals (org_id, lifecycle_phase);
create index if not exists deals_delivery_status_idx on public.deals (org_id, delivery_status)
  where delivery_status is not null;
create index if not exists deals_accepted_proposal_id_idx on public.deals (accepted_proposal_id)
  where accepted_proposal_id is not null;

comment on column public.deals.lifecycle_phase is
  'LBS: opportunity (pre-sale) | delivery (active project) | closed (archived/done).';
comment on column public.deals.delivery_status is
  'LBS agency sub-status within delivery phase (design, dev, review, launch, etc.).';
comment on column public.deals.accepted_proposal_id is
  'Proposal that converted this deal into an active delivery project.';
comment on column public.deals.priority is
  'Project priority for agency workspace sorting and alerts.';

-- Backfill: deals linked to accepted proposals
update public.deals d
set
  lifecycle_phase = 'delivery',
  accepted_proposal_id = p.id,
  delivery_status = coalesce(d.delivery_status, 'planning')
from public.proposals p
where p.deal_id = d.id
  and p.status = 'accepted'
  and d.accepted_proposal_id is null;

-- Backfill: delivered stage → closed lifecycle
update public.deals
set lifecycle_phase = 'closed',
    delivery_status = coalesce(delivery_status, 'completed')
where stage = 'delivered'
  and lifecycle_phase = 'delivery';

-- Backfill: active LBS pipeline deals without delivery_status
update public.deals
set delivery_status = case stage
  when 'setup' then 'planning'
  when 'in_progress' then 'in_development'
  when 'client_review' then 'client_review'
  when 'launch' then 'ready_to_launch'
  when 'delivered' then 'completed'
  else 'planning'
end
where delivery_status is null
  and lifecycle_phase in ('delivery', 'closed');
