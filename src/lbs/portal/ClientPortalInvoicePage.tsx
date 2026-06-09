import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, Loader2, Wallet } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { InvoiceDocumentPreview } from "@/lbs/billing/InvoiceDocumentPreview";
import {
  buildClientInvoicePdfContext,
  downloadClientInvoicePdf,
} from "@/lbs/billing/clientInvoicePdf";
import { computeInvoiceBalanceDue } from "@/lbs/billing/invoicePaymentUtils";
import { lineItemsToInvoiceDrafts } from "@/lbs/billing/invoiceLineUtils";
import {
  fetchPublicInvoice,
  type PublicInvoicePayload,
} from "@/lbs/billing/public/publicInvoiceApi";
import { PayInvoiceDialog } from "@/lbs/billing/public/PayInvoiceDialog";
import { PublicInvoicePaymentFlow } from "@/lbs/billing/public/PublicInvoicePaymentFlow";
import { ClientPortalLayout } from "@/lbs/portal/ClientPortalLayout";
import {
  PORTAL_LOCALE_KEY,
  type PortalLocale,
} from "@/lbs/portal/portalI18n";
import { INVOICE_DOCUMENT_MAX_WIDTH_CLASS } from "@/lbs/billing/invoiceDocumentLayout";

const payloadToInvoiceRecord = (
  payload: PublicInvoicePayload,
): { invoice: ClientInvoice; lineItems: ClientInvoiceLineItem[] } => {
  const { invoice, line_items } = payload;
  const lineItems: ClientInvoiceLineItem[] = line_items.map((line, index) => ({
    id: index,
    invoice_id: invoice.id,
    description: line.description,
    quantity: line.quantity,
    unit: line.unit ?? "ea",
    unit_price: line.unit_price,
    line_total: line.line_total,
    sort_order: line.sort_order ?? index,
  }));

  return {
    invoice: {
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      issue_date: invoice.issue_date,
      due_date: invoice.due_date,
      amount: invoice.amount,
      subtotal: invoice.subtotal ?? invoice.amount,
      discount_amount: invoice.discount_amount ?? 0,
      fee_amount: invoice.fee_amount ?? 0,
      currency: invoice.currency ?? "USD",
      terms: invoice.terms ?? null,
      description: invoice.description,
      notes: invoice.notes ?? null,
      status: invoice.status ?? "sent",
      reference: invoice.reference ?? null,
      upfront_percent: invoice.upfront_percent ?? 100,
      auto_charge_remainder: invoice.auto_charge_remainder ?? false,
      amount_paid: invoice.amount_paid ?? 0,
      save_card_for_future_charges: invoice.save_card_for_future_charges ?? false,
      remainder_schedule: invoice.remainder_schedule ?? null,
    } as ClientInvoice,
    lineItems,
  };
};

export const ClientPortalInvoicePage = () => {
  const { token = "" } = useParams();
  const [locale, setLocale] = useState<PortalLocale>(() => {
    const stored = localStorage.getItem(PORTAL_LOCALE_KEY);
    return stored === "en" ? "en" : "es";
  });
  const [payload, setPayload] = useState<PublicInvoicePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const loadInvoice = useCallback(() => {
    if (!token) {
      setError("Invalid link");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    void fetchPublicInvoice(token)
      .then(setPayload)
      .catch((err: Error) => {
        setError(err.message || "Could not load invoice");
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    loadInvoice();
  }, [loadInvoice]);

  const fullPortalHref = useMemo(() => {
    if (!payload?.portal_token) return null;
    return `/portal?token=${encodeURIComponent(payload.portal_token)}`;
  }, [payload?.portal_token]);

  const handleDownload = async () => {
    if (!payload) return;
    setDownloading(true);
    try {
      const { invoice, lineItems } = payloadToInvoiceRecord(payload);
      const { bill_to, organization } = payload;
      const pdfContext = buildClientInvoicePdfContext({
        invoice,
        organizationName: organization.name,
        organizationAddress: organization.address ?? null,
        organizationWebsite: organization.website ?? null,
        company: bill_to.company_name
          ? { name: bill_to.company_name }
          : null,
        contact: bill_to.contact_name
          ? {
              first_name: bill_to.contact_name.split(" ")[0] ?? "",
              last_name: bill_to.contact_name.split(" ").slice(1).join(" ") || "",
            }
          : null,
        lineItems,
        billToEmail: bill_to.email ?? undefined,
      });
      await downloadClientInvoicePdf(pdfContext);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not download PDF");
    } finally {
      setDownloading(false);
    }
  };

  const accountEmail = payload?.bill_to.email ?? null;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const payRequested =
    searchParams.get("pay") === "1" || searchParams.get("pay") === "true";

  const payModeActive = Boolean(
    payload &&
      payRequested &&
      payload.invoice.status !== "paid" &&
      computeInvoiceBalanceDue(
        Number(payload.invoice.amount) || 0,
        Number(payload.invoice.amount_paid) || 0,
      ) > 0.01,
  );

  if (!loading && !error && payModeActive && payload) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4 py-10">
        <PublicInvoicePaymentFlow
          token={payload.token}
          payload={payload}
          focusPaymentEntry
          onSuccess={() => {
            loadInvoice();
            navigate(`/portal/invoice/${payload.token}`, { replace: true });
          }}
        />
      </div>
    );
  }

  return (
    <ClientPortalLayout
      mode="invoice"
      locale={locale}
      onLocaleChange={setLocale}
      fullPortalHref={fullPortalHref}
      accountEmail={accountEmail}
    >
      {loading ? (
        <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Loading invoice…
        </div>
      ) : error || !payload ? (
        <div className="flex min-h-[50vh] items-center justify-center px-6 text-center text-sm text-muted-foreground">
          {error ?? "Invoice not found"}
        </div>
      ) : (
        <InvoicePortalContent
          payload={payload}
          downloading={downloading}
          onDownload={() => void handleDownload()}
          onPaymentSuccess={loadInvoice}
        />
      )}
    </ClientPortalLayout>
  );
};

const InvoicePortalContent = ({
  payload,
  downloading,
  onDownload,
  onPaymentSuccess,
}: {
  payload: PublicInvoicePayload;
  downloading: boolean;
  onDownload: () => void;
  onPaymentSuccess: () => void;
}) => {
  const navigate = useNavigate();
  const [payOpen, setPayOpen] = useState(false);
  const { invoice, line_items, organization, bill_to } = payload;
  const lines = useMemo(() => lineItemsToInvoiceDrafts(line_items), [line_items]);
  const total = Number(invoice.amount) || 0;
  const amountPaid = Number(invoice.amount_paid) || 0;
  const balanceDue = computeInvoiceBalanceDue(total, amountPaid);
  const isPaid = invoice.status === "paid" || balanceDue <= 0;
  const currency = invoice.currency ?? "USD";
  const balanceFormatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(balanceDue);

  const company = bill_to.company_name ? { name: bill_to.company_name } : null;
  const contact = bill_to.contact_name
    ? {
        first_name: bill_to.contact_name.split(" ")[0] ?? "",
        last_name: bill_to.contact_name.split(" ").slice(1).join(" ") || "",
        email_jsonb: bill_to.email
          ? [{ email: bill_to.email, isPrimary: true }]
          : undefined,
        phone_jsonb: bill_to.phone
          ? [{ number: bill_to.phone, isPrimary: true }]
          : undefined,
      }
    : null;

  const handlePaymentSuccess = () => {
    onPaymentSuccess();
    navigate(`/portal/invoice/${payload.token}`, { replace: true });
  };

  return (
    <div className="px-3 py-4 sm:px-4 sm:py-6 md:px-8 md:py-8">
      <div className={`mx-auto w-full ${INVOICE_DOCUMENT_MAX_WIDTH_CLASS}`}>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          {isPaid ? (
            <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 sm:w-auto sm:py-1.5">
              <CheckCircle2 className="size-4" />
              Paid in full
            </span>
          ) : (
            <Button
              type="button"
              size="sm"
              className="w-full bg-amber-500 text-amber-950 hover:bg-amber-400 sm:w-auto"
              onClick={() => setPayOpen(true)}
            >
              <Wallet className="size-4" />
              Pay now
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            disabled={downloading}
            onClick={onDownload}
          >
            {downloading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Download invoice
          </Button>
        </div>

        <InvoiceDocumentPreview
          organizationName={organization.name}
          organizationWebsite={organization.website}
          organizationAddress={organization.address}
          invoiceNumber={invoice.invoice_number}
          status={invoice.status}
          issueDate={invoice.issue_date}
          dueDate={invoice.due_date}
          terms={invoice.terms ?? "Net 30"}
          company={company}
          contact={contact}
          lines={lines}
          termsAndConditions={invoice.notes}
          subtotal={Number(invoice.subtotal ?? invoice.amount) || 0}
          discountAmount={Number(invoice.discount_amount) || 0}
          feeAmount={Number(invoice.fee_amount) || 0}
          total={total}
          balanceDue={balanceDue}
          className="pb-0"
        />

        {!isPaid ? (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Amount due:{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {balanceFormatted}
            </span>
          </p>
        ) : null}
      </div>

      {!isPaid ? (
        <PayInvoiceDialog
          open={payOpen}
          onOpenChange={setPayOpen}
          token={payload.token}
          payload={payload}
          onSuccess={handlePaymentSuccess}
        />
      ) : null}
    </div>
  );
};
