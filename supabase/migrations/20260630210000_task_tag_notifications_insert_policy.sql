-- Allow org members to create tag notifications on tasks in their workspace.

drop policy if exists "task_tag_notifications_insert" on public.task_tag_notifications;

create policy "task_tag_notifications_insert" on public.task_tag_notifications
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.tasks t
      where t.id = task_tag_notifications.task_id
        and t.org_id = public.current_user_org_id()
    )
    and exists (
      select 1
      from public.organization_members om
      where om.id = task_tag_notifications.recipient_organization_member_id
        and om.org_id = public.current_user_org_id()
        and coalesce(om.disabled, false) = false
    )
    and (
      task_tag_notifications.person_id is null
      or exists (
        select 1
        from public.people p
        where p.id = task_tag_notifications.person_id
          and p.org_id = public.current_user_org_id()
      )
    )
  );
