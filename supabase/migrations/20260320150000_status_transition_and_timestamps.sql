create or replace function public.enforce_payment_status_transition()
returns trigger
language plpgsql
as $$
begin
  if old.status is distinct from new.status then
    if old.status = 'draft' and new.status not in ('draft', 'approved') then
      raise exception 'Invalid payments status transition: % -> %', old.status, new.status;
    elsif old.status = 'approved' and new.status not in ('approved', 'draft', 'paid') then
      raise exception 'Invalid payments status transition: % -> %', old.status, new.status;
    elsif old.status = 'paid' and new.status not in ('paid', 'approved') then
      raise exception 'Invalid payments status transition: % -> %', old.status, new.status;
    end if;
  end if;

  if new.status = 'draft' then
    new.approved_at := null;
    new.paid_at := null;
  elsif new.status = 'approved' then
    new.approved_at := coalesce(new.approved_at, now());
    new.paid_at := null;
  elsif new.status = 'paid' then
    new.approved_at := coalesce(new.approved_at, now());
    new.paid_at := coalesce(new.paid_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists payments_enforce_status_transition on public.payments;

create trigger payments_enforce_status_transition
before update of status, approved_at, paid_at
on public.payments
for each row
execute function public.enforce_payment_status_transition();

create or replace function public.enforce_payroll_run_status_transition()
returns trigger
language plpgsql
as $$
begin
  if old.status is distinct from new.status then
    if old.status = 'draft' and new.status not in ('draft', 'reviewed', 'approved', 'cancelled') then
      raise exception 'Invalid payroll_runs status transition: % -> %', old.status, new.status;
    elsif old.status = 'reviewed' and new.status not in ('reviewed', 'draft', 'approved', 'cancelled') then
      raise exception 'Invalid payroll_runs status transition: % -> %', old.status, new.status;
    elsif old.status = 'approved' and new.status not in ('approved', 'reviewed', 'draft', 'cancelled', 'paid') then
      raise exception 'Invalid payroll_runs status transition: % -> %', old.status, new.status;
    elsif old.status = 'paid' and new.status not in ('paid', 'approved') then
      raise exception 'Invalid payroll_runs status transition: % -> %', old.status, new.status;
    elsif old.status = 'cancelled' and new.status not in ('cancelled', 'draft') then
      raise exception 'Invalid payroll_runs status transition: % -> %', old.status, new.status;
    end if;
  end if;

  if new.status in ('draft', 'reviewed', 'cancelled') then
    if new.status <> 'approved' then
      new.approved_at := null;
    end if;
    if new.status <> 'paid' then
      new.paid_at := null;
    end if;
  elsif new.status = 'approved' then
    new.approved_at := coalesce(new.approved_at, now());
    new.paid_at := null;
  elsif new.status = 'paid' then
    new.approved_at := coalesce(new.approved_at, now());
    new.paid_at := coalesce(new.paid_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists payroll_runs_enforce_status_transition on public.payroll_runs;

create trigger payroll_runs_enforce_status_transition
before update of status, approved_at, paid_at
on public.payroll_runs
for each row
execute function public.enforce_payroll_run_status_transition();
