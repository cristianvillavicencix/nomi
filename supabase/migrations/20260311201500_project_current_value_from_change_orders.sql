create or replace function public.recompute_deal_current_project_value(p_deal_id bigint)
returns void
language plpgsql
as $$
declare
  v_original numeric(12,2);
  v_adjustment numeric(12,2);
begin
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

create or replace function public.handle_recompute_deal_current_project_value_from_change_orders()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_deal_current_project_value(old.deal_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.deal_id is distinct from new.deal_id then
    perform public.recompute_deal_current_project_value(old.deal_id);
  end if;

  perform public.recompute_deal_current_project_value(new.deal_id);
  return new;
end;
$$;

drop trigger if exists trg_recompute_deal_current_project_value_on_change_orders on public.deal_change_orders;
create trigger trg_recompute_deal_current_project_value_on_change_orders
after insert or update or delete on public.deal_change_orders
for each row execute function public.handle_recompute_deal_current_project_value_from_change_orders();

create or replace function public.handle_recompute_deal_current_project_value_from_deals()
returns trigger
language plpgsql
as $$
begin
  perform public.recompute_deal_current_project_value(new.id);
  return new;
end;
$$;

drop trigger if exists trg_recompute_deal_current_project_value_on_deals on public.deals;
create trigger trg_recompute_deal_current_project_value_on_deals
after insert or update of original_project_value, estimated_value, amount on public.deals
for each row execute function public.handle_recompute_deal_current_project_value_from_deals();

do $$
declare
  v_id bigint;
begin
  for v_id in select id from public.deals loop
    perform public.recompute_deal_current_project_value(v_id);
  end loop;
end $$;
