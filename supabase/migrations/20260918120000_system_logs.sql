-- System logs table for structured logging and monitoring
-- Enables centralized tracking of errors, warnings, and operational events

create table if not exists public.system_logs (
  id bigserial primary key,
  level text not null
    check (level in ('error', 'warn', 'info', 'debug')),
  module text not null,
  operation text not null,
  context jsonb not null default '{}'::jsonb,
  timestamp timestamptz not null default now(),
  user_id bigint,
  org_id bigint references public.organizations (id) on delete cascade,
  invoice_id bigint,
  ticket_id bigint,
  payment_intent_id text,
  created_at timestamptz not null default now()
);

-- Indexes for common queries
create index if not exists system_logs_level_idx 
  on public.system_logs (level);

create index if not exists system_logs_module_idx 
  on public.system_logs (module);

create index if not exists system_logs_org_id_idx 
  on public.system_logs (org_id) 
  where org_id is not null;

create index if not exists system_logs_invoice_id_idx 
  on public.system_logs (invoice_id) 
  where invoice_id is not null;

create index if not exists system_logs_ticket_id_idx 
  on public.system_logs (ticket_id) 
  where ticket_id is not null;

create index if not exists system_logs_timestamp_idx 
  on public.system_logs (timestamp desc);

-- Composite index for error monitoring
create index if not exists system_logs_org_level_timestamp_idx 
  on public.system_logs (org_id, level, timestamp desc)
  where org_id is not null and level = 'error';

-- Enable RLS
alter table public.system_logs enable row level security;

-- Only service role can write logs (edge functions)
grant select on public.system_logs to authenticated;
grant all on public.system_logs to service_role;

create policy "system_logs_select_service_only"
  on public.system_logs for select to service_role
  using (true);

create policy "system_logs_insert_service_only"
  on public.system_logs for insert to service_role
  with check (true);

create policy "system_logs_update_service_only"
  on public.system_logs for update to service_role
  using (true)
  with check (true);

create policy "system_logs_delete_service_only"
  on public.system_logs for delete to service_role
  using (true);

-- Authenticated users can only read their own org's logs
create policy "system_logs_select_org_scoped"
  on public.system_logs for select to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('system.view')
  );

comment on table public.system_logs is
  'Structured system logs for monitoring, debugging, and error tracking across all modules';

comment on column public.system_logs.level is
  'Log level: error, warn, info, debug';

comment on column public.system_logs.module is
  'Module or component that generated the log (e.g., ticketDelivery, invoicePayment)';

comment on column public.system_logs.operation is
  'Specific operation or function that generated the log';

comment on column public.system_logs.context is
  'Structured context data as JSONB (error details, parameters, etc.)';

comment on column public.system_logs.timestamp is
  'When the log event occurred (may differ from created_at if backdated)';

-- Retention policy: keep logs for 90 days
-- This can be adjusted based on compliance requirements
comment on table public.system_logs is
  'Logs are retained for 90 days. Adjust retention policy as needed for compliance.';
