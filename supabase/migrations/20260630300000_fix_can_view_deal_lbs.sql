-- LBS stores organization_members.id in salesperson_ids; contractor uses people.id.

create or replace function public.can_view_deal(p_deal_id bigint)
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
  )
  select case
    when not exists (select 1 from me) then false
    when (select administrator from me) then true
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
          or public.current_user_person_id() = any (d.salesperson_ids)
          or public.current_user_person_id() = any (d.worker_ids)
          or public.current_user_person_id() = any (d.subcontractor_ids)
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
