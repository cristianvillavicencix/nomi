create or replace function public.mark_payment_time_entries_paid()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'paid' and old.status is distinct from 'paid' then
    update public.time_entries te
    set
      status = 'paid',
      included_in_payroll = true,
      payment_run_id = new.id
    where te.id in (
      select pl.source_id
      from public.payment_lines pl
      where pl.payment_id = new.id
        and pl.source_type = 'time_entry'
        and pl.source_id is not null
    );
  elsif old.status = 'paid' and new.status is distinct from 'paid' then
    update public.time_entries te
    set
      payment_run_id = null,
      included_in_payroll = case
        when te.payroll_run_id is not null then true
        else false
      end,
      status = case
        when te.status = 'paid' then
          case
            when te.payroll_run_id is not null then 'included_in_payroll'
            else 'approved'
          end
        when te.status = 'included_in_payroll' and te.payroll_run_id is null then 'approved'
        else te.status
      end
    where te.payment_run_id = new.id
      and te.id in (
        select pl.source_id
        from public.payment_lines pl
        where pl.payment_id = new.id
          and pl.source_type = 'time_entry'
          and pl.source_id is not null
      );
  end if;

  return new;
end;
$$;

create or replace function public.mark_payroll_run_entries_paid()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'paid' and old.status is distinct from 'paid' then
    update public.time_entries te
    set
      status = 'paid',
      included_in_payroll = true,
      payroll_run_id = new.id
    where te.payroll_run_id = new.id;
  elsif old.status = 'paid' and new.status is distinct from 'paid' then
    update public.time_entries te
    set
      status = case
        when te.status = 'paid' then 'included_in_payroll'
        else te.status
      end,
      included_in_payroll = true
    where te.payroll_run_id = new.id;
  end if;

  return new;
end;
$$;
