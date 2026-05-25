drop policy if exists "form_submissions_v2_update" on public.form_submissions_v2;

create policy "form_submissions_v2_update" on public.form_submissions_v2
  for update to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('forms.submissions.view')
  )
  with check (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('forms.submissions.view')
  );
