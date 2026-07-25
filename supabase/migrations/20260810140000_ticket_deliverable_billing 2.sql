-- Per-deliverable billing: type + line count (supplements)

alter table public.ticket_deliverables
  add column if not exists billing_kind text
    check (
      billing_kind is null
      or billing_kind in ('supplement', 'roof', 'siding', 'esx', 'pdf_analysis')
    ),
  add column if not exists billing_line_count integer
    check (billing_line_count is null or billing_line_count >= 0);

comment on column public.ticket_deliverables.billing_kind is
  'Invoice line type for this deliverable (supplement, roof, siding, esx, pdf_analysis).';

comment on column public.ticket_deliverables.billing_line_count is
  'Xactimate line count when billing_kind is supplement.';
