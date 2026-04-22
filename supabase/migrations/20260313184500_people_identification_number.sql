alter table public.people
add column if not exists identification_number text;

comment on column public.people.identification_number is
'Government or internal identification number used on payroll and legal receipts.';
