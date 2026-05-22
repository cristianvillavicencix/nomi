-- Realtime filters on non-PK columns require FULL replica identity.
alter table public.conversation_messages replica identity full;
