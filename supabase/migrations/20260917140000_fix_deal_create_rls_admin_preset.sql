-- Fix deal create RLS failures for admin-preset members (administrator=false)
-- and AFTER INSERT recompute updates under invoker RLS.
--
-- Symptoms: "new row violates row-level security policy for table deals"
-- when creating a deal assigned to another member (INSERT … RETURNING / trigger UPDATE).
--
-- Note: hosted LBS uses organization_members.id in salesperson_ids (no people stack /
-- current_user_person_id). Keep can_view_deal aligned with that shape.

-- 1) Treat role_preset admin / admin.users.manage like full org admin for deal visibility.
create or replace function public.can_view_deal(p_deal_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select
      id,
      administrator,
      org_id,
      coalesce(module_permissions, '{}'::jsonb) as module_permissions
    from public.organization_members
    where user_id = auth.uid()
    limit 1
  )
  select case
    when not exists (select 1 from me) then false
    when (select administrator from me) then true
    when coalesce((select module_permissions ->> '_role_preset' from me), '') = 'admin'
      then true
    when coalesce((select module_permissions ->> 'admin.users.manage' from me), '') = 'true'
      then true
    when not exists (select 1 from public.deals where id = p_deal_id) then false
    when (select org_id from public.deals where id = p_deal_id)
      is distinct from (select org_id from me) then false
    when not public.current_member_is_scoped_user() then true
    else exists (
      select 1
      from public.deals d
      cross join me
      where d.id = p_deal_id
        and d.org_id = me.org_id
        and (
          d.organization_member_id = me.id
          or me.id = any (d.salesperson_ids)
          or exists (
            select 1
            from public.record_shares rs
            where rs.resource_type = 'deals'
              and rs.resource_id = d.id
              and rs.member_id = me.id
          )
        )
    )
  end;
$$;

grant execute on function public.can_view_deal(bigint) to authenticated;

-- 2) Keep the creating member on salesperson_ids so INSERT … RETURNING can see the row
-- even when organization_member_id is assigned to someone else (scoped users).
create or replace function public.trg_deals_ensure_creator_on_team()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id bigint := public.current_user_member_id();
begin
  if tg_op <> 'INSERT' then
    return new;
  end if;

  if v_member_id is null then
    return new;
  end if;

  new.salesperson_ids := coalesce(new.salesperson_ids, '{}'::bigint[]);

  if not (v_member_id = any (new.salesperson_ids)) then
    new.salesperson_ids := array_append(new.salesperson_ids, v_member_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_deals_ensure_creator_on_team on public.deals;
create trigger trg_deals_ensure_creator_on_team
before insert on public.deals
for each row
execute function public.trg_deals_ensure_creator_on_team();

-- 3) Recompute current_project_value as definer so AFTER INSERT does not fail UPDATE RLS.
create or replace function public.recompute_deal_current_project_value(p_deal_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_original numeric(12,2);
  v_adjustment numeric(12,2);
begin
  if p_deal_id is null then
    return;
  end if;

  select
    coalesce(
      d.original_project_value,
      d.estimated_value,
      d.amount,
      0
    )::numeric(12,2)
  into v_original
  from public.deals d
  where d.id = p_deal_id;

  if v_original is null then
    return;
  end if;

  select
    coalesce(sum(coalesce(co.amount, 0)), 0)::numeric(12,2)
  into v_adjustment
  from public.deal_change_orders co
  where co.deal_id = p_deal_id
    and co.status = 'approved';

  update public.deals
  set
    current_project_value = (v_original + v_adjustment)::numeric(12,2),
    updated_at = now()
  where id = p_deal_id;
end;
$$;

create or replace function public.handle_recompute_deal_current_project_value_from_deals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recompute_deal_current_project_value(new.id);
  return new;
end;
$$;

-- 4) Insert policy: require create capability (admins/presets already have it).
drop policy if exists "deals_insert_same_org" on public.deals;

create policy "deals_insert_scoped" on public.deals
  for insert
  to authenticated
  with check (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('crm.pipeline.create')
  );
