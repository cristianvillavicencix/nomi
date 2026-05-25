-- Enable live refresh of project assets when clients submit the resources wizard.
do $$
begin
  alter publication supabase_realtime add table public.deal_resources;
exception
  when duplicate_object then null;
end $$;
