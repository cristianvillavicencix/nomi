-- Allow org members to read tag notifications on tasks in their workspace
-- (needed to dedupe inserts and for task owners to see assignment state).

drop policy if exists "task_tag_notifications_select" on public.task_tag_notifications;

create policy "task_tag_notifications_select" on public.task_tag_notifications
  for select to authenticated
  using (
    recipient_organization_member_id in (
      select om.id
      from public.organization_members om
      where om.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.tasks t
      where t.id = task_tag_notifications.task_id
        and t.org_id = public.current_user_org_id()
    )
  );
