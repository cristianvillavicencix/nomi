-- Client proposal billing: saved card + scheduled charges + audit logs

alter table public.contracts
  add column if not exists stripe_payment_method_id text,
  add column if not exists payment_method_brand text,
  add column if not exists payment_method_last4 text;

comment on column public.contracts.stripe_payment_method_id is
  'Default Stripe PaymentMethod for off-session installment charges.';
comment on column public.contracts.payment_method_brand is
  'Card brand from Stripe PM (visa, mastercard, etc.).';
comment on column public.contracts.payment_method_last4 is
  'Last 4 digits of saved card.';

create index if not exists contracts_stripe_customer_idx
  on public.contracts (stripe_customer_id)
  where stripe_customer_id is not null;

alter table public.deal_client_payments
  add column if not exists installment_id bigint
    references public.proposal_payment_installments (id)
    on delete set null,
  add column if not exists stripe_payment_intent_id text;

create unique index if not exists deal_client_payments_stripe_pi_uidx
  on public.deal_client_payments (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create index if not exists deal_client_payments_installment_idx
  on public.deal_client_payments (installment_id)
  where installment_id is not null;

update public.deal_client_payments dcp
set installment_id = ppi.id
from public.proposal_payment_installments ppi
where dcp.installment_id is null
  and dcp.reference_number = 'proposal-installment-' || ppi.id::text;

alter table public.proposal_payment_installments
  drop constraint if exists proposal_payment_installments_status_check;

alter table public.proposal_payment_installments
  add constraint proposal_payment_installments_status_check
  check (
    status in (
      'pending',
      'processing',
      'requires_action',
      'paid',
      'failed',
      'skipped',
      'waived'
    )
  );

create index if not exists proposal_payment_installments_due_pending_idx
  on public.proposal_payment_installments (due_date asc, org_id)
  where status = 'pending';

create table if not exists public.payment_attempt_logs (
  id bigserial primary key,
  org_id bigint not null
    references public.organizations (id) on delete cascade,
  contract_id bigint not null
    references public.contracts (id) on delete cascade,
  installment_id bigint not null
    references public.proposal_payment_installments (id) on delete cascade,
  stripe_payment_intent_id text,
  amount_cents integer not null check (amount_cents > 0),
  status text not null
    check (status in ('processing', 'succeeded', 'failed', 'requires_action')),
  error_code text,
  error_message text,
  retry_count integer not null default 0 check (retry_count >= 0),
  attempted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists payment_attempt_logs_installment_idx
  on public.payment_attempt_logs (installment_id, attempted_at desc);

create index if not exists payment_attempt_logs_contract_idx
  on public.payment_attempt_logs (contract_id, attempted_at desc);

create index if not exists payment_attempt_logs_stripe_pi_idx
  on public.payment_attempt_logs (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

alter table public.payment_attempt_logs enable row level security;

grant select on public.payment_attempt_logs to authenticated;
grant all on public.payment_attempt_logs to service_role;

create policy "payment_attempt_logs_org_scoped"
  on public.payment_attempt_logs for select to authenticated
  using (org_id = public.current_user_org_id());

comment on column public.proposals.status is
  'Includes paid_in_full when all proposal_payment_installments are paid.';
