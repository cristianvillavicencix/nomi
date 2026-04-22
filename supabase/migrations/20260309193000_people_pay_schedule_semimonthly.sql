-- Normalize pay schedule token: semimonthly

update public.people
set pay_schedule = 'semimonthly'
where pay_schedule = 'semi_monthly';

alter table public.people
  drop constraint if exists people_pay_schedule_check;

alter table public.people
  add constraint people_pay_schedule_check
  check (pay_schedule in ('weekly', 'biweekly', 'semimonthly', 'monthly'));
