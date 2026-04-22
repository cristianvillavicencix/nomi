create or replace function public.recalculate_payment_totals(p_payment_id bigint)
returns void
language plpgsql
as $$
begin
  update public.payments py
  set
    total_gross = coalesce((
      select round(coalesce(sum(coalesce(pl.total_pay, pl.amount)), 0), 2)
      from public.payment_lines pl
      where pl.payment_id = p_payment_id
    ), 0),
    total_net = coalesce((
      select round(coalesce(sum(coalesce(pl.total_pay, pl.amount)), 0), 2)
      from public.payment_lines pl
      where pl.payment_id = p_payment_id
    ), 0)
  where py.id = p_payment_id;
end;
$$;

create or replace function public.payment_lines_sync_payment_totals()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    perform public.recalculate_payment_totals(new.payment_id);
    return new;
  elsif tg_op = 'UPDATE' then
    perform public.recalculate_payment_totals(old.payment_id);
    if new.payment_id is distinct from old.payment_id then
      perform public.recalculate_payment_totals(new.payment_id);
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    perform public.recalculate_payment_totals(old.payment_id);
    return old;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists payment_lines_sync_payment_totals on public.payment_lines;

create trigger payment_lines_sync_payment_totals
after insert or update or delete
on public.payment_lines
for each row
execute function public.payment_lines_sync_payment_totals();

update public.payments py
set
  total_gross = coalesce(lines.total_amount, 0),
  total_net = coalesce(lines.total_amount, 0)
from (
  select payment_id, round(coalesce(sum(coalesce(total_pay, amount)), 0), 2) as total_amount
  from public.payment_lines
  group by payment_id
) lines
where py.id = lines.payment_id;

update public.payments py
set total_gross = 0,
    total_net = 0
where not exists (
  select 1
  from public.payment_lines pl
  where pl.payment_id = py.id
);
