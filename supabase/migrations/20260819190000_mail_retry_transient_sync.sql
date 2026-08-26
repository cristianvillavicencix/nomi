-- Cron skipped mailboxes stuck in status=error after a one-off IMAP timeout.
-- Retry those accounts; auth failures stay in error until the user reconnects.

create or replace function public.mail_accounts_due_for_sync(p_limit int default 20)
returns setof public.mail_accounts
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.mail_accounts
  where (
      status = 'connected'
      or (
        status = 'error'
        and coalesce(error_message, '') ~* 'timeout|connection|unreachable|required time|temporar|network'
      )
    )
    and (
      last_sync_at is null
      or last_sync_at < now() - interval '5 minutes'
    )
  order by last_sync_at nulls first
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

comment on function public.mail_accounts_due_for_sync(int) is
  'Accounts due for mail_sync cron. Includes transient IMAP/network errors so a timeout cannot disable sync forever.';
