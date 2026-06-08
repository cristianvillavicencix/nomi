-- Daily cron for client invoice payment reminders and auto-debit charges.
-- Reuses vault secrets: website_monitor_project_url + website_monitor_cron_secret
-- (same as other edge-function cron jobs in this project).

create or replace function public.invoke_client_invoice_billing_cron(function_slug text)
returns bigint
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  project_url text;
  cron_secret text;
  request_id bigint;
begin
  if function_slug is null or function_slug !~ '^[a-z0-9_]+$' then
    return null;
  end if;

  select decrypted_secret into project_url
  from vault.decrypted_secrets
  where name = 'website_monitor_project_url'
  limit 1;

  select decrypted_secret into cron_secret
  from vault.decrypted_secrets
  where name = 'website_monitor_cron_secret'
  limit 1;

  if project_url is null or cron_secret is null then
    return null;
  end if;

  select net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/' || function_slug,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', cron_secret
    ),
    body := '{}'::jsonb
  )
  into request_id;

  return request_id;
end;
$$;

comment on function public.invoke_client_invoice_billing_cron(text) is
  'Invokes a client invoice billing edge function (process_invoice_payment_reminders | process_invoice_auto_charges).';

grant execute on function public.invoke_client_invoice_billing_cron(text) to service_role;

do $cron_setup$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'client_invoice_payment_reminders_daily'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'client_invoice_payment_reminders_daily',
    '0 14 * * *',
    $$select public.invoke_client_invoice_billing_cron('process_invoice_payment_reminders');$$
  );

  select jobid into existing_job_id
  from cron.job
  where jobname = 'client_invoice_auto_charges_daily'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'client_invoice_auto_charges_daily',
    '0 15 * * *',
    $$select public.invoke_client_invoice_billing_cron('process_invoice_auto_charges');$$
  );
end;
$cron_setup$;
