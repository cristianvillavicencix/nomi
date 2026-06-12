-- Daily pg_cron backfill for payment receipt emails on paid client invoices.
-- Reuses invoke_client_invoice_billing_cron (vault: website_monitor_project_url,
-- website_monitor_cron_secret) — same pattern as client_invoice_payment_reminders_daily.
-- Scheduled 30 minutes after reminders (14:00 UTC → 14:30 UTC) to avoid overlap.

comment on function public.invoke_client_invoice_billing_cron(text) is
  'Invokes a client invoice billing edge function (process_invoice_payment_reminders | process_invoice_auto_charges | process_missed_invoice_payment_receipts).';

do $cron_setup$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'process_missed_invoice_payment_receipts_daily'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'process_missed_invoice_payment_receipts_daily',
    '30 14 * * *',
    $$select public.invoke_client_invoice_billing_cron('process_missed_invoice_payment_receipts');$$
  );
end;
$cron_setup$;
