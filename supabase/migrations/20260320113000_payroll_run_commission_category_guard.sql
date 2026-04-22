create or replace function public.prevent_sales_commissions_payroll_runs()
returns trigger
language plpgsql
as $$
begin
  if new.category = 'sales_commissions' then
    raise exception
      'Category "sales_commissions" is not allowed in payroll_runs. Use payments for commission payouts.';
  end if;

  return new;
end;
$$;

drop trigger if exists payroll_runs_prevent_sales_commissions on public.payroll_runs;

create trigger payroll_runs_prevent_sales_commissions
before insert or update on public.payroll_runs
for each row
execute function public.prevent_sales_commissions_payroll_runs();
