-- Allow marking a payment run as paid in one step from draft (matches "Aprobar pago" UX).
create or replace function public.enforce_payment_status_transition()
returns trigger
language plpgsql
as $$
begin
  if old.status is distinct from new.status then
    if old.status = 'draft' and new.status not in ('draft', 'approved', 'paid') then
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
