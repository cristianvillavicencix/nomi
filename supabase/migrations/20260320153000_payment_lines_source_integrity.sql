create or replace function public.validate_payment_line_source_integrity()
returns trigger
language plpgsql
as $$
declare
  v_payment public.payments%rowtype;
  v_person public.people%rowtype;
  v_time_entry public.time_entries%rowtype;
  v_deal public.deals%rowtype;
begin
  select * into v_payment from public.payments where id = new.payment_id;
  if v_payment is null then
    raise exception 'Payment % not found for payment_line', new.payment_id;
  end if;

  if new.source_type in ('time_entry', 'salary', 'commission') then
    if new.source_id is null then
      raise exception 'payment_lines.source_id is required for source_type %', new.source_type;
    end if;

    if new.person_id is null then
      raise exception 'payment_lines.person_id is required for source_type %', new.source_type;
    end if;
  elsif new.source_type = 'adjustment' then
    if new.source_id is not null then
      raise exception 'payment_lines.source_id must be null for source_type adjustment';
    end if;
  end if;

  if new.person_id is not null then
    select * into v_person from public.people where id = new.person_id;

    if v_person is null then
      raise exception 'Person % not found for payment_line', new.person_id;
    end if;

    if v_person.org_id is distinct from v_payment.org_id then
      raise exception 'payment_lines person org mismatch for line % (person.org_id %, payment.org_id %)',
        coalesce(new.id, 0), v_person.org_id, v_payment.org_id;
    end if;
  end if;

  if new.source_type = 'time_entry' then
    select * into v_time_entry from public.time_entries where id = new.source_id;

    if v_time_entry is null then
      raise exception 'Time entry % not found for payment_line', new.source_id;
    end if;

    if v_time_entry.person_id is distinct from new.person_id then
      raise exception 'payment_lines person_id must match time_entries.person_id for source_id %', new.source_id;
    end if;

    if v_time_entry.org_id is distinct from v_payment.org_id then
      raise exception 'payment_lines time_entry org mismatch for source_id %', new.source_id;
    end if;

    if new.project_id is null then
      new.project_id := v_time_entry.project_id;
    elsif v_time_entry.project_id is distinct from new.project_id then
      raise exception 'payment_lines project_id must match time_entries.project_id for source_id %', new.source_id;
    end if;
  elsif new.source_type = 'salary' then
    if new.source_id is distinct from new.person_id then
      raise exception 'payment_lines salary source_id must equal person_id';
    end if;
  elsif new.source_type = 'commission' then
    select * into v_deal from public.deals where id = new.source_id;

    if v_deal is null then
      raise exception 'Deal % not found for commission payment_line', new.source_id;
    end if;

    if v_deal.sales_id is distinct from new.person_id
      and not (v_deal.salesperson_ids is not null and new.person_id = any(v_deal.salesperson_ids)) then
      raise exception 'payment_lines commission person % is not assigned as salesperson on deal %',
        new.person_id,
        v_deal.id;
    end if;

    if new.project_id is null then
      new.project_id := v_deal.id;
    elsif new.project_id is distinct from v_deal.id then
      raise exception 'payment_lines commission project_id must equal deal id (source_id)';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists payment_lines_validate_source_integrity on public.payment_lines;

create trigger payment_lines_validate_source_integrity
before insert or update of payment_id, person_id, project_id, source_type, source_id
on public.payment_lines
for each row
execute function public.validate_payment_line_source_integrity();
