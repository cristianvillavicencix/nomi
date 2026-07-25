-- Paginated mail thread search for CRM Mail hub

drop function if exists public.mail_search_threads(text, bigint, int);

create or replace function public.mail_search_threads(
  p_query text,
  p_account_id bigint default null,
  p_limit int default 50,
  p_offset int default 0
)
returns setof public.mail_threads
language sql
stable
security invoker
as $$
  select t.*
  from public.mail_threads t
  where t.is_trashed = false
    and (p_account_id is null or t.account_id = p_account_id)
    and (
      p_query is null
      or length(trim(p_query)) = 0
      or t.search_document @@ plainto_tsquery('english', p_query)
      or t.subject ilike '%' || p_query || '%'
      or t.snippet ilike '%' || p_query || '%'
    )
  order by
    case
      when p_query is not null and length(trim(p_query)) > 0
        then ts_rank(t.search_document, plainto_tsquery('english', p_query))
      else 0
    end desc,
    t.last_message_at desc nulls last
  offset greatest(0, coalesce(p_offset, 0))
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

create or replace function public.mail_search_threads_count(
  p_query text,
  p_account_id bigint default null
)
returns bigint
language sql
stable
security invoker
as $$
  select count(*)::bigint
  from public.mail_threads t
  where t.is_trashed = false
    and (p_account_id is null or t.account_id = p_account_id)
    and (
      p_query is null
      or length(trim(p_query)) = 0
      or t.search_document @@ plainto_tsquery('english', p_query)
      or t.subject ilike '%' || p_query || '%'
      or t.snippet ilike '%' || p_query || '%'
    );
$$;

grant execute on function public.mail_search_threads(text, bigint, int, int) to authenticated;
grant execute on function public.mail_search_threads_count(text, bigint) to authenticated;

comment on function public.mail_search_threads is
  'FTS + ilike fallback for CRM Mail thread list search (paginated).';
comment on function public.mail_search_threads_count is
  'Total matches for mail_search_threads.';
