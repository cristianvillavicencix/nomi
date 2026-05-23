-- Remove conversations that were created without any messages (e.g. failed SMS send).

delete from public.conversations c
where not exists (
  select 1
  from public.conversation_messages m
  where m.conversation_id = c.id
);
