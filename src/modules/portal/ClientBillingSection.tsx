import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PortalCopy, PortalLocale } from "@/modules/portal/portalI18n";
import {
  formatPortalDate,
  type PortalInvoice,
  type PortalPayment,
} from "@/modules/portal/portalTypes";

const formatMoney = (amount: number, currency = "USD", locale: PortalLocale) =>
  new Intl.NumberFormat(locale === "es" ? "es-US" : "en-US", {
    style: "currency",
    currency,
  }).format(amount);

const invoiceStatusLabel = (status: string, copy: PortalCopy) => {
  if (status === "paid") return copy.invoiceStatusPaid;
  if (status === "sent") return copy.invoiceStatusSent;
  if (status === "overdue") return copy.invoiceStatusOverdue;
  if (status === "draft") return copy.invoiceStatusDraft;
  return status.replace(/_/g, " ");
};

const invoiceStatusVariant = (
  status: string,
): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "paid") return "default";
  if (status === "overdue") return "destructive";
  if (status === "sent") return "secondary";
  return "outline";
};

const paymentStatusLabel = (
  status: string | null | undefined,
  copy: PortalCopy,
) => {
  const normalized = String(status ?? "").toLowerCase();
  if (
    normalized === "paid" ||
    normalized === "cleared" ||
    normalized === "deposited"
  ) {
    return copy.paymentStatusCompleted;
  }
  if (normalized === "pending") return copy.paymentStatusPending;
  return status?.replace(/_/g, " ") ?? "—";
};

export const ClientBillingSection = ({
  invoices = [],
  payments = [],
  copy,
  locale,
}: {
  invoices?: PortalInvoice[];
  payments?: PortalPayment[];
  copy: PortalCopy;
  locale: PortalLocale;
}) => {
  const localeTag = locale === "es" ? "es-US" : "en-US";
  const hasInvoices = invoices.length > 0;
  const hasPayments = payments.length > 0;

  if (!hasInvoices && !hasPayments) {
    return (
      <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        {copy.noBillingRecords}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">{copy.billingIntro}</p>

      {hasInvoices ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            {copy.billingInvoicesTitle}
          </h2>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{copy.invoiceNumberColumn}</TableHead>
                  <TableHead>{copy.invoiceDateColumn}</TableHead>
                  <TableHead>{copy.invoiceAmountColumn}</TableHead>
                  <TableHead>{copy.invoiceStatusColumn}</TableHead>
                  <TableHead className="text-right">
                    {copy.actionsColumn}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => {
                  const balanceDue = Math.max(
                    0,
                    Number(invoice.amount) - Number(invoice.amount_paid),
                  );
                  const canPay =
                    invoice.status !== "paid" &&
                    invoice.status !== "void" &&
                    balanceDue > 0 &&
                    Boolean(invoice.portal_token);
                  const href = invoice.portal_token
                    ? `/portal/invoice/${invoice.portal_token}${canPay ? "?pay=1" : ""}`
                    : null;

                  return (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        {invoice.invoice_number}
                      </TableCell>
                      <TableCell>
                        {formatPortalDate(invoice.issue_date, localeTag)}
                      </TableCell>
                      <TableCell>
                        {formatMoney(
                          Number(invoice.amount),
                          invoice.currency,
                          locale,
                        )}
                        {Number(invoice.amount_paid) > 0 ? (
                          <div className="text-xs text-muted-foreground">
                            {copy.invoicePaidAmount}:{" "}
                            {formatMoney(
                              Number(invoice.amount_paid),
                              invoice.currency,
                              locale,
                            )}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={invoiceStatusVariant(invoice.status)}
                          className="font-normal"
                        >
                          {invoiceStatusLabel(invoice.status, copy)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {href ? (
                          <Button asChild size="sm" variant="outline">
                            <a href={href} target="_blank" rel="noreferrer">
                              <ExternalLink className="size-4" />
                              {canPay
                                ? copy.invoicePayAction
                                : copy.invoiceViewAction}
                            </a>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </section>
      ) : null}

      {hasPayments ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            {copy.billingPaymentsTitle}
          </h2>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{copy.paymentDateColumn}</TableHead>
                  <TableHead>{copy.paymentReferenceColumn}</TableHead>
                  <TableHead>{copy.paymentMethodColumn}</TableHead>
                  <TableHead>{copy.paymentStatusColumn}</TableHead>
                  <TableHead className="text-right">
                    {copy.paymentAmountColumn}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={`${payment.source}-${payment.id}`}>
                    <TableCell>
                      {formatPortalDate(payment.payment_date, localeTag)}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {payment.invoice_number ??
                          payment.reference_number ??
                          payment.check_number ??
                          "—"}
                      </div>
                      {payment.source === "invoice" ? (
                        <div className="text-xs text-muted-foreground">
                          {copy.paymentSourceInvoice}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          {copy.paymentSourceProject}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="capitalize">
                      {payment.payment_method?.replace(/_/g, " ") ?? "—"}
                    </TableCell>
                    <TableCell>
                      {paymentStatusLabel(payment.status, copy)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMoney(Number(payment.amount), "USD", locale)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      ) : null}
    </div>
  );
};
