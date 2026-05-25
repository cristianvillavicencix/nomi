alter table public.form_instances
  add column if not exists task_assignee_member_id bigint references public.organization_members (id) on delete set null,
  add column if not exists task_title_template text default 'Follow up on {form_name} from {submitter_name}';

comment on column public.form_instances.task_assignee_member_id is
  'Member assigned to auto-created follow-up tasks from submissions';
comment on column public.form_instances.task_title_template is
  'Template for auto-created tasks. Variables: {form_name}, {submitter_name}, {submitter_email}';
