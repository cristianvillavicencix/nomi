-- Author attribution for operational records (admin audit trail).

alter table public.deal_expenses
  add column if not exists created_by_member_id bigint references public.organization_members (id) on delete set null;

alter table public.deal_change_orders
  add column if not exists created_by_member_id bigint references public.organization_members (id) on delete set null;

alter table public.deal_client_payments
  add column if not exists created_by_member_id bigint references public.organization_members (id) on delete set null;

alter table public.deal_commissions
  add column if not exists created_by_member_id bigint references public.organization_members (id) on delete set null;

alter table public.deal_resources
  add column if not exists created_by_member_id bigint references public.organization_members (id) on delete set null;

alter table public.deal_access_entries
  add column if not exists created_by_member_id bigint references public.organization_members (id) on delete set null;

alter table public.proposals
  add column if not exists created_by_member_id bigint references public.organization_members (id) on delete set null;

alter table public.contracts
  add column if not exists created_by_member_id bigint references public.organization_members (id) on delete set null;

update public.deal_resources
set created_by_member_id = organization_member_id
where created_by_member_id is null
  and organization_member_id is not null;

update public.deal_access_entries
set created_by_member_id = organization_member_id
where created_by_member_id is null
  and organization_member_id is not null;

update public.proposals
set created_by_member_id = organization_member_id
where created_by_member_id is null
  and organization_member_id is not null;

update public.contracts
set created_by_member_id = organization_member_id
where created_by_member_id is null
  and organization_member_id is not null;

create or replace function public.set_created_by_member_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by_member_id is null then
    new.created_by_member_id := public.current_user_member_id();
  end if;
  return new;
end;
$$;

drop trigger if exists set_created_by_deal_expenses on public.deal_expenses;
create trigger set_created_by_deal_expenses
  before insert on public.deal_expenses
  for each row execute function public.set_created_by_member_id();

drop trigger if exists set_created_by_deal_change_orders on public.deal_change_orders;
create trigger set_created_by_deal_change_orders
  before insert on public.deal_change_orders
  for each row execute function public.set_created_by_member_id();

drop trigger if exists set_created_by_deal_client_payments on public.deal_client_payments;
create trigger set_created_by_deal_client_payments
  before insert on public.deal_client_payments
  for each row execute function public.set_created_by_member_id();

drop trigger if exists set_created_by_deal_commissions on public.deal_commissions;
create trigger set_created_by_deal_commissions
  before insert on public.deal_commissions
  for each row execute function public.set_created_by_member_id();

drop trigger if exists set_created_by_deal_resources on public.deal_resources;
create trigger set_created_by_deal_resources
  before insert on public.deal_resources
  for each row execute function public.set_created_by_member_id();

drop trigger if exists set_created_by_deal_access_entries on public.deal_access_entries;
create trigger set_created_by_deal_access_entries
  before insert on public.deal_access_entries
  for each row execute function public.set_created_by_member_id();

drop trigger if exists set_created_by_proposals on public.proposals;
create trigger set_created_by_proposals
  before insert on public.proposals
  for each row execute function public.set_created_by_member_id();

drop trigger if exists set_created_by_contracts on public.contracts;
create trigger set_created_by_contracts
  before insert on public.contracts
  for each row execute function public.set_created_by_member_id();
