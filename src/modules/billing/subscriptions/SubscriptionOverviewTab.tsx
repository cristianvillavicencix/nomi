import { useMemo, type ReactNode } from "react";
import { Link } from "react-router";
import { useGetList, useGetMany } from "ra-core";
import type { Company, Contact } from "@/components/atomic-crm/types";
import { getClientShowPath } from "@/app/routing";
import { formatBillingDate } from "@/modules/billing/billingDisplayUtils";
import {
  formatContactName,
} from "@/modules/billing/billingUtils";
import {
  resolveBillingRecipientEmail,
  resolveBillingRecipientPhone,
} from "@/modules/billing/billingRecipientResolution";
import {
  formatSubscriptionAmountLabel,
  subscriptionStatusLabel,
} from "@/modules/billing/subscriptions/subscriptionDisplayUtils";
import { subscriptionChargeFromNet } from "@/modules/billing/subscriptions/subscriptionFeeUtils";
import { formatSubscriptionScheduleLabel } from "@/modules/billing/subscriptions/subscriptionScheduleUtils";
import { resolveCompanyAddressForDisplay } from "@/modules/clients/clientAddressUtils";
import type { ClientInvoice, ClientSubscription } from "@/modules/types";
import { MoneyText } from "@/lib/permissions/MoneyText";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SubscriptionOverviewTabProps = {
  subscription: ClientSubscription;
};

const SummaryRow = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => (
  <div className="flex items-start justify-between gap-3 border-b py-2 text-sm last:border-b-0">
    <span className="text-muted-foreground">{label}</span>
    <span className="max-w-[60%] text-right font-medium">{value}</span>
  </div>
);

const OverviewCard = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <div className="rounded-lg border bg-background p-4">
    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {title}
    </h3>
    {children}
  </div>
);

const parseLineItems = (subscription: ClientSubscription) => {
  if (!Array.isArray(subscription.line_items)) return [];
  return subscription.line_items
    .filter((row) => row && typeof row === "object")
    .map((row) => {
      const record = row as Record<string, unknown>;
      const qty = Number(record.quantity ?? 1) || 1;
      const unitPrice = Number(record.unit_price ?? 0) || 0;
      return {
        description: String(record.description ?? subscription.name ?? "Item"),
        quantity: qty,
        unitPrice,
        amount: qty * unitPrice,
      };
    });
};

export const SubscriptionOverviewTab = ({
  subscription,
}: SubscriptionOverviewTabProps) => {
  const { data: companies = [] } = useGetMany<Company>(
    "companies",
    { ids: subscription.company_id ? [subscription.company_id] : [] },
    { enabled: Boolean(subscription.company_id) },
  );
  const { data: contacts = [] } = useGetMany<Contact>(
    "contacts",
    { ids: subscription.contact_id ? [subscription.contact_id] : [] },
    { enabled: Boolean(subscription.contact_id) },
  );

  const company = companies[0];
  const contact = contacts[0];
  const clientLabel =
    company?.name ?? formatContactName(contact) ?? "No customer";
  const email = resolveBillingRecipientEmail({ company, contact });
  const phone = resolveBillingRecipientPhone({ company, contact });
  const address = company ? resolveCompanyAddressForDisplay(company) : "—";
  const clientPath = subscription.company_id
    ? getClientShowPath(subscription.company_id)
    : null;

  const lineItems = useMemo(
    () => parseLineItems(subscription),
    [subscription],
  );

  const { data: relatedInvoices = [] } = useGetList<ClientInvoice>(
    "client_invoices",
    {
      filter: { "subscription_id@eq": String(subscription.id) },
      sort: { field: "issue_date", order: "DESC" },
      pagination: { page: 1, perPage: 200 },
    },
    { enabled: Boolean(subscription.id) },
  );

  const totalBilled = useMemo(
    () =>
      relatedInvoices.reduce(
        (sum, invoice) => sum + (Number(invoice.amount) || 0),
        0,
      ),
    [relatedInvoices],
  );

  const amountLabel = formatSubscriptionAmountLabel(
    Number(subscription.amount),
    subscription.currency,
    subscription.billing_interval,
  );
  const charge = subscriptionChargeFromNet(Number(subscription.amount));
  const clientPaysLabel = formatSubscriptionAmountLabel(
    charge.total,
    subscription.currency,
    subscription.billing_interval,
  );

  const schedule = formatSubscriptionScheduleLabel({
    startsAt: subscription.starts_at?.slice(0, 10) ?? null,
    endsAt: subscription.ends_at?.slice(0, 10) ?? null,
    billingInterval: subscription.billing_interval,
  });
  const scheduleLabel = `${schedule.start} – ${schedule.end}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="space-y-4">
        <OverviewCard title="Customer">
          <div className="space-y-2 text-sm">
            {clientPath ? (
              <Link
                to={clientPath}
                className="font-medium text-primary hover:underline"
              >
                {clientLabel}
              </Link>
            ) : (
              <p className="font-medium">{clientLabel}</p>
            )}
            {email ? (
              <p className="text-muted-foreground">
                <a href={`mailto:${email}`} className="hover:underline">
                  {email}
                </a>
              </p>
            ) : null}
            {phone ? (
              <p className="text-muted-foreground">{phone}</p>
            ) : null}
            {address !== "—" ? (
              <p className="text-muted-foreground">{address}</p>
            ) : null}
          </div>
        </OverviewCard>

        <OverviewCard title="Payment">
          <SummaryRow
            label="Gateway"
            value="Stripe"
          />
          <SummaryRow
            label="Card on file"
            value={
              subscription.payment_method_last4
                ? `${subscription.payment_method_brand ?? "Card"} ····${subscription.payment_method_last4}`
                : "None"
            }
          />
          <SummaryRow
            label="Autocharge"
            value={
              subscription.status === "active" ||
              subscription.status === "trialing"
                ? "Enabled"
                : "Not active"
            }
          />
        </OverviewCard>

        {subscription.enrollment_mode === "agreement" ? (
          <OverviewCard title="Agreement">
            <SummaryRow
              label="Status"
              value={
                subscription.agreement_signed_at
                  ? "Signed"
                  : "Awaiting signature"
              }
            />
            {subscription.agreement_signatory_name ? (
              <SummaryRow
                label="Signed by"
                value={subscription.agreement_signatory_name}
              />
            ) : null}
            {subscription.agreement_signed_at ? (
              <SummaryRow
                label="Signed at"
                value={formatBillingDate(
                  subscription.agreement_signed_at.slice(0, 10),
                )}
              />
            ) : null}
            {subscription.agreement_signature_png?.startsWith("data:image/") ? (
              <div className="mt-2 space-y-1">
                <p className="text-xs text-muted-foreground">Signature</p>
                <img
                  src={subscription.agreement_signature_png}
                  alt="Client signature"
                  className="max-h-24 rounded-md border bg-white"
                />
              </div>
            ) : null}
          </OverviewCard>
        ) : null}

        <OverviewCard title="Status">
          <SummaryRow
            label="Status"
            value={subscriptionStatusLabel(subscription.status)}
          />
          {subscription.cancel_at_period_end ? (
            <SummaryRow label="Cancellation" value="At period end" />
          ) : null}
          {subscription.paused_at ? (
            <SummaryRow
              label="Paused"
              value={formatBillingDate(subscription.paused_at.slice(0, 10))}
            />
          ) : null}
          {subscription.canceled_at ? (
            <SummaryRow
              label="Canceled"
              value={formatBillingDate(subscription.canceled_at.slice(0, 10))}
            />
          ) : null}
        </OverviewCard>
      </div>

      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Plan (net)", value: amountLabel },
            { label: "Client pays", value: clientPaysLabel },
            {
              label: "Next billing",
              value: formatBillingDate(
                subscription.next_billing_at?.slice(0, 10),
              ),
            },
            {
              label: "Total billed",
              value: (
                <MoneyText value={totalBilled} />
              ),
            },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-lg border bg-background px-3 py-3"
            >
              <p className="text-xs text-muted-foreground">{label}</p>
              <div className="mt-1 text-sm font-semibold">{value}</div>
            </div>
          ))}
        </div>

        <OverviewCard title="Schedule">
          <SummaryRow label="Term" value={scheduleLabel} />
          <SummaryRow
            label="Current period"
            value={
              subscription.current_period_start && subscription.current_period_end
                ? `${formatBillingDate(subscription.current_period_start.slice(0, 10))} – ${formatBillingDate(subscription.current_period_end.slice(0, 10))}`
                : "—"
            }
          />
        </OverviewCard>

        <OverviewCard title="Items">
          {lineItems.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="w-16 text-right">Qty</TableHead>
                  <TableHead className="w-24 text-right">Price</TableHead>
                  <TableHead className="w-24 text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.map((row, index) => (
                  <TableRow key={`${row.description}-${index}`}>
                    <TableCell>{row.description}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.quantity}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <MoneyText value={row.unitPrice} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <MoneyText value={row.amount} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              {subscription.name} —{" "}
              <MoneyText value={Number(subscription.amount)} />
            </p>
          )}
          <div className="mt-3 flex justify-end border-t pt-3 text-sm font-semibold">
            Total{" "}
            <span className="ml-2 tabular-nums">
              <MoneyText value={Number(subscription.amount)} />
            </span>
          </div>
        </OverviewCard>
      </div>
    </div>
  );
};
