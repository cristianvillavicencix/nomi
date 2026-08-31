-- Search ticket IDs by message body / HTML (org-scoped). Used by Tickets list search.

create or replace function public.search_ticket_ids_by_message(
  p_query text,
  p_limit int default 100
)
returns setof bigint
language sql
stable
security invoker
set search_path = public
as $$
  select distinct tm.ticket_id
  from public.ticket_messages tm
  inner join public.tickets t
    on t.id = tm.ticket_id
  where t.org_id = public.current_user_org_id()
    and t.merged_into_ticket_id is null
    and p_query is not null
    and length(trim(p_query)) >= 2
    and (
      coalesce(tm.body, '') ilike '%' || trim(p_query) || '%'
      or coalesce(tm.html_body, '') ilike '%' || trim(p_query) || '%'
    )
  order by tm.ticket_id desc
  limit greatest(1, least(coalesce(p_limit, 100), 200));
$$;

grant execute on function public.search_ticket_ids_by_message(text, int) to authenticated;

comment on function public.search_ticket_ids_by_message is
  'Distinct ticket ids whose messages match a case-insensitive phrase (body or html_body).';
