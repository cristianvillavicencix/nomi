-- CRM Mail module: multi-account inbox (org + personal). Separate from ticket_inboxes.

create table if not exists public.mail_accounts (
  id bigserial primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  owner_member_id bigint references public.organization_members (id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft', 'imap')),
  email text not null,
  display_name text,
  status text not null default 'pending'
    check (status in ('pending', 'connected', 'error', 'disabled', 'needs_reconnect')),
  scopes text[] not null default '{}',
  -- Encrypted at rest by Edge (MAIL_TOKEN_SECRET); never returned to clients via PostgREST selects of these cols.
  token_payload jsonb not null default '{}'::jsonb,
  imap_host text,
  imap_port int,
  imap_security text check (imap_security is null or imap_security in ('ssl', 'starttls', 'none')),
  imap_username text,
  smtp_host text,
  smtp_port int,
  smtp_security text check (smtp_security is null or smtp_security in ('ssl', 'starttls', 'none')),
  last_sync_at timestamptz,
  sync_cursor jsonb not null default '{}'::jsonb,
  error_message text,
  created_by_member_id bigint references public.organization_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists mail_accounts_org_email_owner_uidx
  on public.mail_accounts (org_id, lower(email), coalesce(owner_member_id, 0));

create index if not exists mail_accounts_org_idx on public.mail_accounts (org_id);
create index if not exists mail_accounts_owner_idx on public.mail_accounts (owner_member_id)
  where owner_member_id is not null;
create index if not exists mail_accounts_status_idx on public.mail_accounts (org_id, status);

comment on table public.mail_accounts is
  'Connected mailboxes for CRM Mail. owner_member_id null = org-shared; set = personal.';

create table if not exists public.mail_folders (
  id bigserial primary key,
  account_id bigint not null references public.mail_accounts (id) on delete cascade,
  org_id bigint not null references public.organizations (id) on delete cascade,
  provider_folder_id text not null,
  name text not null,
  role text,
  unread_count int not null default 0,
  total_count int not null default 0,
  created_at timestamptz not null default now(),
  unique (account_id, provider_folder_id)
);

create index if not exists mail_folders_account_idx on public.mail_folders (account_id);

create table if not exists public.mail_labels (
  id bigserial primary key,
  account_id bigint not null references public.mail_accounts (id) on delete cascade,
  org_id bigint not null references public.organizations (id) on delete cascade,
  provider_label_id text not null,
  name text not null,
  color text,
  created_at timestamptz not null default now(),
  unique (account_id, provider_label_id)
);

create table if not exists public.mail_threads (
  id bigserial primary key,
  account_id bigint not null references public.mail_accounts (id) on delete cascade,
  org_id bigint not null references public.organizations (id) on delete cascade,
  provider_thread_id text not null,
  subject text,
  snippet text,
  participants jsonb not null default '[]'::jsonb,
  last_message_at timestamptz,
  is_unread boolean not null default false,
  is_starred boolean not null default false,
  is_draft boolean not null default false,
  is_archived boolean not null default false,
  is_trashed boolean not null default false,
  folder_ids bigint[] not null default '{}',
  label_ids bigint[] not null default '{}',
  message_count int not null default 0,
  search_document tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, provider_thread_id)
);

create index if not exists mail_threads_account_last_idx
  on public.mail_threads (account_id, last_message_at desc nulls last);
create index if not exists mail_threads_org_unread_idx
  on public.mail_threads (org_id, is_unread)
  where is_unread = true;
create index if not exists mail_threads_search_idx
  on public.mail_threads using gin (search_document);

create table if not exists public.mail_messages (
  id bigserial primary key,
  thread_id bigint not null references public.mail_threads (id) on delete cascade,
  account_id bigint not null references public.mail_accounts (id) on delete cascade,
  org_id bigint not null references public.organizations (id) on delete cascade,
  provider_message_id text not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  from_email text,
  from_name text,
  to_emails text[] not null default '{}',
  cc_emails text[] not null default '{}',
  bcc_emails text[] not null default '{}',
  subject text,
  body_text text,
  body_html text,
  in_reply_to text,
  sent_at timestamptz,
  is_read boolean not null default false,
  has_attachments boolean not null default false,
  send_status text check (
    send_status is null or send_status in ('pending', 'sent', 'failed')
  ),
  send_error text,
  raw_headers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (account_id, provider_message_id)
);

create index if not exists mail_messages_thread_idx
  on public.mail_messages (thread_id, sent_at nulls last);

create table if not exists public.mail_attachments (
  id bigserial primary key,
  message_id bigint not null references public.mail_messages (id) on delete cascade,
  account_id bigint not null references public.mail_accounts (id) on delete cascade,
  org_id bigint not null references public.organizations (id) on delete cascade,
  provider_attachment_id text,
  filename text not null,
  mime_type text,
  size_bytes bigint,
  storage_path text,
  created_at timestamptz not null default now()
);

create index if not exists mail_attachments_message_idx on public.mail_attachments (message_id);

create table if not exists public.mail_drafts (
  id bigserial primary key,
  account_id bigint not null references public.mail_accounts (id) on delete cascade,
  org_id bigint not null references public.organizations (id) on delete cascade,
  owner_member_id bigint not null references public.organization_members (id) on delete cascade,
  thread_id bigint references public.mail_threads (id) on delete set null,
  provider_draft_id text,
  to_emails text[] not null default '{}',
  cc_emails text[] not null default '{}',
  bcc_emails text[] not null default '{}',
  subject text,
  body_html text,
  body_text text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.mail_sync_jobs (
  id bigserial primary key,
  account_id bigint not null references public.mail_accounts (id) on delete cascade,
  org_id bigint not null references public.organizations (id) on delete cascade,
  job_type text not null default 'incremental'
    check (job_type in ('full', 'incremental', 'send', 'push')),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed')),
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists mail_sync_jobs_account_idx
  on public.mail_sync_jobs (account_id, created_at desc);

-- Helpers for RLS (current_user_member_id already exists in prior migrations)
create or replace function public.mail_account_is_readable(p_account public.mail_accounts)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_account.org_id = public.current_user_org_id()
    and (
      (
        p_account.owner_member_id is null
        and public.current_member_has_capability('mail.org.view')
      )
      or (
        p_account.owner_member_id = public.current_user_member_id()
        and public.current_member_has_capability('mail.personal.view')
      )
    );
$$;

-- RLS
alter table public.mail_accounts enable row level security;
alter table public.mail_folders enable row level security;
alter table public.mail_labels enable row level security;
alter table public.mail_threads enable row level security;
alter table public.mail_messages enable row level security;
alter table public.mail_attachments enable row level security;
alter table public.mail_drafts enable row level security;
alter table public.mail_sync_jobs enable row level security;

grant select on public.mail_accounts to authenticated;
grant select, update on public.mail_folders to authenticated;
grant select on public.mail_labels to authenticated;
grant select, update on public.mail_threads to authenticated;
grant select, update on public.mail_messages to authenticated;
grant select on public.mail_attachments to authenticated;
grant select, insert, update, delete on public.mail_drafts to authenticated;
grant select on public.mail_sync_jobs to authenticated;

-- Clients must not read token_payload via API: revoke column via view for list UI
create or replace view public.mail_accounts_safe
with (security_invoker = true)
as
select
  id,
  org_id,
  owner_member_id,
  provider,
  email,
  display_name,
  status,
  scopes,
  imap_host,
  imap_port,
  imap_security,
  imap_username,
  smtp_host,
  smtp_port,
  smtp_security,
  last_sync_at,
  error_message,
  created_by_member_id,
  created_at,
  updated_at
from public.mail_accounts;

grant select on public.mail_accounts_safe to authenticated;

create policy mail_accounts_select on public.mail_accounts
  for select to authenticated
  using (public.mail_account_is_readable(mail_accounts));

create policy mail_accounts_insert_org on public.mail_accounts
  for insert to authenticated
  with check (
    org_id = public.current_user_org_id()
    and (
      (
        owner_member_id is null
        and public.current_member_has_capability('mail.org.manage')
      )
      or (
        owner_member_id = public.current_user_member_id()
        and public.current_member_has_capability('mail.personal.manage')
      )
    )
  );

create policy mail_accounts_update on public.mail_accounts
  for update to authenticated
  using (
    org_id = public.current_user_org_id()
    and (
      (
        owner_member_id is null
        and public.current_member_has_capability('mail.org.manage')
      )
      or (
        owner_member_id = public.current_user_member_id()
        and public.current_member_has_capability('mail.personal.manage')
      )
    )
  )
  with check (org_id = public.current_user_org_id());

create policy mail_accounts_delete on public.mail_accounts
  for delete to authenticated
  using (
    org_id = public.current_user_org_id()
    and (
      (
        owner_member_id is null
        and public.current_member_has_capability('mail.org.manage')
      )
      or (
        owner_member_id = public.current_user_member_id()
        and public.current_member_has_capability('mail.personal.manage')
      )
      or (
        owner_member_id is not null
        and public.current_member_has_capability('mail.org.manage')
      )
    )
  );

create policy mail_folders_select on public.mail_folders
  for select to authenticated
  using (
    exists (
      select 1 from public.mail_accounts a
      where a.id = mail_folders.account_id
        and public.mail_account_is_readable(a)
    )
  );

create policy mail_folders_update on public.mail_folders
  for update to authenticated
  using (
    exists (
      select 1 from public.mail_accounts a
      where a.id = mail_folders.account_id
        and public.mail_account_is_readable(a)
    )
  );

create policy mail_labels_select on public.mail_labels
  for select to authenticated
  using (
    exists (
      select 1 from public.mail_accounts a
      where a.id = mail_labels.account_id
        and public.mail_account_is_readable(a)
    )
  );

create policy mail_threads_select on public.mail_threads
  for select to authenticated
  using (
    exists (
      select 1 from public.mail_accounts a
      where a.id = mail_threads.account_id
        and public.mail_account_is_readable(a)
    )
  );

create policy mail_threads_update on public.mail_threads
  for update to authenticated
  using (
    exists (
      select 1 from public.mail_accounts a
      where a.id = mail_threads.account_id
        and public.mail_account_is_readable(a)
    )
  );

create policy mail_messages_select on public.mail_messages
  for select to authenticated
  using (
    exists (
      select 1 from public.mail_accounts a
      where a.id = mail_messages.account_id
        and public.mail_account_is_readable(a)
    )
  );

create policy mail_messages_update on public.mail_messages
  for update to authenticated
  using (
    exists (
      select 1 from public.mail_accounts a
      where a.id = mail_messages.account_id
        and public.mail_account_is_readable(a)
    )
  );

create policy mail_attachments_select on public.mail_attachments
  for select to authenticated
  using (
    exists (
      select 1 from public.mail_accounts a
      where a.id = mail_attachments.account_id
        and public.mail_account_is_readable(a)
    )
  );

create policy mail_drafts_all on public.mail_drafts
  for all to authenticated
  using (
    org_id = public.current_user_org_id()
    and owner_member_id = public.current_user_member_id()
  )
  with check (
    org_id = public.current_user_org_id()
    and owner_member_id = public.current_user_member_id()
  );

create policy mail_sync_jobs_select on public.mail_sync_jobs
  for select to authenticated
  using (
    exists (
      select 1 from public.mail_accounts a
      where a.id = mail_sync_jobs.account_id
        and public.mail_account_is_readable(a)
    )
  );

-- Storage bucket for attachments
insert into storage.buckets (id, name, public)
values ('mail-attachments', 'mail-attachments', false)
on conflict (id) do nothing;

drop policy if exists mail_attachments_storage_select on storage.objects;
create policy mail_attachments_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'mail-attachments'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
  );

-- Keep search_document updated
create or replace function public.mail_threads_search_trigger()
returns trigger
language plpgsql
as $$
begin
  new.search_document :=
    setweight(to_tsvector('english', coalesce(new.subject, '')), 'A')
    || setweight(to_tsvector('english', coalesce(new.snippet, '')), 'B');
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists mail_threads_search_biu on public.mail_threads;
create trigger mail_threads_search_biu
before insert or update of subject, snippet on public.mail_threads
for each row execute function public.mail_threads_search_trigger();

alter publication supabase_realtime add table public.mail_threads;
alter publication supabase_realtime add table public.mail_messages;
