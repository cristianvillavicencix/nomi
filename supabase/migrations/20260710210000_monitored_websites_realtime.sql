-- Realtime updates for Web Monitor list (live status without full refetch).

alter table public.monitored_websites replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'monitored_websites'
  ) then
    alter publication supabase_realtime add table public.monitored_websites;
  end if;
end;
$$;
