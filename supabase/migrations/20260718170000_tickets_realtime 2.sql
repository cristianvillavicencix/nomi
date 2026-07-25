-- Live refresh for ticket inbox when inbound email creates tickets/messages.

do $$
begin
  alter publication supabase_realtime add table public.tickets;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.ticket_messages;
exception
  when duplicate_object then null;
end $$;
