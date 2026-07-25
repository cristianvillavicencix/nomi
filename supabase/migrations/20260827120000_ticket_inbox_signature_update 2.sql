-- Allow org admins / ticket managers to edit ticket inbox reply signatures from Settings.

grant update on public.ticket_inboxes to authenticated;

create policy "ticket_inboxes_update_org" on public.ticket_inboxes
  for update to authenticated
  using (
    org_id = public.current_user_org_id()
    and (
      public.current_member_has_capability('admin.settings.manage')
      or public.current_member_has_capability('support.tickets.manage')
    )
  )
  with check (
    org_id = public.current_user_org_id()
    and (
      public.current_member_has_capability('admin.settings.manage')
      or public.current_member_has_capability('support.tickets.manage')
    )
  );
