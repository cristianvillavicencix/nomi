-- Gmail/Outlook spam folder support for CRM Mail UI.
alter table public.mail_threads
  add column if not exists is_spam boolean not null default false;

create index if not exists mail_threads_account_spam_idx
  on public.mail_threads (account_id, last_message_at desc nulls last)
  where is_spam = true and is_trashed = false;
