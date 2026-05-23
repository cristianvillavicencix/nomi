-- Enable Supabase Realtime for multi-user Kanban updates.

alter table public.deals replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.deals;
exception
  when duplicate_object then null;
end $$;
