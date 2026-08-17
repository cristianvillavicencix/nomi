-- Realtime UPDATE payloads need old.assignee_id so clients can ignore
-- subject/status edits and only notify on actual assignment changes.
alter table public.tickets replica identity full;
