-- Performance + contact lookup for messaging edge functions

create index if not exists idx_messages_external_id
  on public.conversation_messages (external_id)
  where external_id is not null;

create or replace function public.find_contact_by_phone(p_org_id bigint, p_phone text)
returns table (
  id bigint,
  first_name text,
  last_name text,
  phone_jsonb jsonb,
  company_id bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.first_name, c.last_name, c.phone_jsonb, c.company_id
  from public.contacts c
  where c.org_id = p_org_id
    and c.phone_jsonb is not null
    and exists (
      select 1
      from jsonb_array_elements(c.phone_jsonb) elem
      where regexp_replace(coalesce(elem->>'number', ''), '[^0-9+]', '', 'g')
        = regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g')
         or right(regexp_replace(coalesce(elem->>'number', ''), '[^0-9]', '', 'g'), 10)
          = right(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), 10)
    )
  limit 1;
$$;

revoke all on function public.find_contact_by_phone(bigint, text) from public, authenticated;
grant execute on function public.find_contact_by_phone(bigint, text) to service_role;
