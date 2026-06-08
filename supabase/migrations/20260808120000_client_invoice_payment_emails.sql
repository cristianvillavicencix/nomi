-- Payment receipt + reminder email deduplication logs.

create table if not exists public.client_invoice_email_logs (
  id bigint generated always as identity primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  invoice_id bigint not null references public.client_invoices (id) on delete cascade,
  email_type text not null check (email_type in ('payment_receipt', 'payment_reminder')),
  reference_key text not null,
  recipient_email text not null,
  sent_at timestamptz not null default now()
);

create unique index if not exists client_invoice_email_logs_dedupe_idx
  on public.client_invoice_email_logs (invoice_id, reference_key);

create index if not exists client_invoice_email_logs_invoice_sent_idx
  on public.client_invoice_email_logs (invoice_id, sent_at desc);

alter table public.client_invoice_email_logs enable row level security;

grant select on public.client_invoice_email_logs to authenticated;
grant all on public.client_invoice_email_logs to service_role;

create policy "client_invoice_email_logs_org_scoped"
  on public.client_invoice_email_logs for select to authenticated
  using (
    org_id in (
      select org_id from public.organization_members where user_id = auth.uid()
    )
  );

comment on table public.client_invoice_email_logs is
  'Deduplicated client invoice payment receipts and payment reminders.';
