# Billing

## 1. Purpose

Client invoicing and revenue at `/billing`: workspace tabs for invoices, proposal installments, and charts. Standalone invoice create at `/billing/invoices/new`. Public pay flow at `/invoice/:token`. Heavy use of **edge functions** for invoice lifecycle (create, issue, send, charge, share). Org subscription billing (seats) is separate via `stripe-billing` (Settings/Users).

## 2. Files & components

| Area | Paths |
|------|-------|
| Main | `src/lbs/billing/ClientBillingPage.tsx`, `InvoiceBillingWorkspace.tsx` |
| Create/Edit | `StandaloneInvoiceCreatePage.tsx`, `StandaloneInvoiceEditPage.tsx`, `CreateClientInvoiceDialog.tsx` |
| Public | `src/lbs/billing/public/PublicInvoicePage.tsx`, `publicInvoiceApi.ts`, short URL redirects |
| Tabs | `ClientInvoicesTab.tsx`, `BillingRevenueChart.tsx` |
| Line items | `InvoiceLineItemsSection.tsx`, `CatalogLineItemField.tsx` |
| Staff actions | `InvoiceStaffChargeDialog.tsx`, `ScheduleInvoiceSendDialog.tsx` |
| Dead | `StandaloneInvoiceShowPage.tsx` — no route (`19-orphaned-routes.md`) |
| Provider | `clientBillingProvider.ts`, dataProvider invoice methods |

## 3. Database

| Table | Role |
|-------|------|
| `client_invoices` | Standalone + synced proposal invoices |
| `client_invoice_line_items` | Lines |
| `public_client_invoice_tokens` | Public pay links |
| `proposal_payment_installments` | Scheduled proposal payments |
| `deal_client_payments` | Recorded payments on deals |
| `organizations` | Stripe customer for **seat** billing (not client invoices) |

**RLS:** Invoice tables org-scoped; public tokens accessed via edge with service role.

## 4. External services

| Service | Usage |
|---------|--------|
| Stripe | Client PaymentIntents (`stripe-client-webhook`), Connect/charge on file |
| Stripe | Org seats (`stripe-billing`, `stripe-webhook`) — Settings module |
| Email | Send invoice / payment link / receipt edge functions |
| Vercel cron | `process-scheduled-payments`, `process-scheduled-client-invoices` |
| pg_cron | `process_invoice_payment_reminders`, `process_invoice_auto_charges` |

## 5. Connections to other modules

| Direction | Module |
|-----------|--------|
| ← Proposals | Installment sync → invoices |
| ↔ Deals / Companies / Contacts | FKs on invoices |
| → Portal | `/portal/invoice/:token` |
| Settings | Stripe keys, commercial settings |

## 6. Edge functions used by this module

| Function | Caller | Purpose |
|----------|--------|---------|
| `create_client_invoice` | `dataProvider.createStandaloneClientInvoice` | New invoice |
| `update_client_invoice` | dataProvider | Draft edits |
| `issue_client_invoice` | dataProvider | Finalize / sync proposal installments |
| `manage_client_invoice` | dataProvider | Void etc. |
| `schedule_client_invoice` | dataProvider | Scheduled send |
| `send_client_invoice` | dataProvider | Immediate send |
| `share_client_invoice` | dataProvider | Public link |
| `charge_client_invoice_on_file` | Staff charge dialog | Off-session charge |
| `send_client_invoice_payment_link` | dataProvider | Email link |
| `resend_client_invoice_payment_receipt` | dataProvider | Receipt resend |
| `get_public_invoice` | `publicInvoiceApi.ts` | Public view |
| `pay_client_invoice` | public API | Pay flow |
| `prepare_client_invoice_payment` | public API | Stripe client secret |
| `process_scheduled_payments` | Vercel cron | Proposal installments |
| `process_scheduled_client_invoices` | Vercel cron | Scheduled sends |
| `process_invoice_payment_reminders` | pg_cron | Reminder emails |
| `process_invoice_auto_charges` | pg_cron | Auto-debit |
| `process_missed_invoice_payment_receipts` | **No pg_cron yet** | Backfill receipts — **plan daily pg_cron in fix phase** (approved 2026-06-02) |
| `stripe-client-webhook` | Stripe (external) | Payment events |

## 7. Status: PARTIAL

Core billing UI and edge integration implemented. Cron overlap at 14:00/15:00 UTC between Vercel and pg_cron targets **different** functions (documented in inventory).

## 8. Issues found

| Severity | Location | User impact | Root cause |
|----------|----------|-------------|------------|
| MEDIUM | `StandaloneInvoiceShowPage` | Dead code | Replaced by `?invoice=` workspace |
| MEDIUM | `process_missed_invoice_payment_receipts` | Receipts may not backfill | No scheduled caller — **fix phase: daily pg_cron** (mirror `invoke_client_invoice_billing_cron`) |
| LOW | Vercel cron comment vs schedule | Ops confusion | Comment says 2h, cron is daily |
| LOW | Public invoice 406 | Rare token issues | Invalid/expired token handling |

## 9. Broken connections

- Invoice routes redirect to `/billing?invoice=` — bookmarks to old paths still work via redirect.
- `sales_person_id` on invoices (not `person_id` revert)—valid column on `client_invoices`.
