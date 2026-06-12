import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  useDataProvider,
  useGetList,
  useGetOne,
  useNotify,
  useRefresh,
} from "ra-core";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { Company, Contact } from "@/components/atomic-crm/types";
import {
  PageActions,
  PageTitle,
} from "@/components/atomic-crm/layout/PageActions";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import { type BillToSelection } from "@/lbs/billing/BillToClientSearch";
import {
  InvoiceCreateActions,
  type InvoiceCreateAction,
} from "@/lbs/billing/InvoiceCreateActions";
import { InvoiceShareLinkDialog } from "@/lbs/billing/InvoiceShareLinkDialog";
import { InlineInvoiceEditor } from "@/lbs/billing/InlineInvoiceEditor";
import { InvoiceOnlinePaymentSetupDialog } from "@/lbs/billing/InvoiceOnlinePaymentSetupDialog";
import { ScheduleInvoiceSendDialog } from "@/lbs/billing/ScheduleInvoiceSendDialog";
import { InvoiceStaffChargeDialog } from "@/lbs/billing/InvoiceStaffChargeDialog";
import { SendInvoiceDialog } from "@/lbs/billing/SendInvoiceDialog";
import {
  billToSelectionFromClient,
  canEditClientInvoice,
  resolveInvoiceRecipientEmail,
} from "@/lbs/billing/billingUtils";
import {
  buildClientInvoicePdfContext,
  downloadClientInvoicePdf,
} from "@/lbs/billing/clientInvoicePdf";
import {
  calculateInvoiceTotals,
  defaultInvoiceDescription,
  discountPercentFromAmount,
  dueDateFromTerms,
  formatLineItemDescription,
  invoiceLineTotal,
  lineItemsToInvoiceDrafts,
  newInvoiceLineKey,
  type InvoiceLineDraft,
} from "@/lbs/billing/invoiceLineUtils";
import {
  computeInvoiceBalanceDue,
  invoicePaymentModeFromRecord,
  upfrontPercentFromMode,
  canChargeClientInvoice,
  type InvoicePaymentCollectionMode,
} from "@/lbs/billing/invoicePaymentUtils";
import {
  defaultInvoiceRemainderSchedule,
  parseInvoiceRemainderSchedule,
  type InvoiceRemainderScheduleConfig,
} from "@/lbs/billing/invoiceRemainderSchedule";
import {
  invoiceStatusLabel,
  invoiceStatusVariant,
} from "@/lbs/billing/billingDisplayUtils";
import { InvoiceDocumentPreview } from "@/lbs/billing/InvoiceDocumentPreview";
import { resolveInvoiceOrganizationName } from "@/lbs/billing/invoiceEmailTemplate";
import { getInvoiceOrganizationBranding } from "@/lbs/billing/invoiceOrganizationInfo";
import type { ClientInvoice, ClientInvoiceLineItem } from "@/lbs/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type StandaloneInvoiceEditPageProps = {
  /** Render inside the billing invoice sidebar workspace. */
  embedded?: boolean;
  /** When embedded, pass the invoice id directly instead of reading from the URL. */
  invoiceId?: string;
};

export const StandaloneInvoiceEditPage = ({
  embedded = false,
  invoiceId: invoiceIdProp,
}: StandaloneInvoiceEditPageProps = {}) => {
  const { id: routeId = "" } = useParams();
  const id = invoiceIdProp ?? routeId;
  const navigate = useNavigate();
  const notify = useNotify();
  const refresh = useRefresh();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const {
    title,
    companyLegalName,
  } = useConfigurationContext();

  const organizationName = useMemo(
    () => resolveInvoiceOrganizationName({ title, companyLegalName }),
    [title, companyLegalName],
  );

  const invoiceBranding = useMemo(() => getInvoiceOrganizationBranding(), []);
  const organizationAddress = invoiceBranding.address;
  const companyWebsite = invoiceBranding.website;

  const [hydrated, setHydrated] = useState(false);
  const [billTo, setBillTo] = useState<BillToSelection | null>(null);
  const [issueDate, setIssueDate] = useState("");
  const [terms, setTerms] = useState("Net 30");
  const [dueDate, setDueDate] = useState("");
  const [saveCard, setSaveCard] = useState(false);
  const [paymentMode, setPaymentMode] =
    useState<InvoicePaymentCollectionMode>("full");
  const [depositPercent, setDepositPercent] = useState(50);
  const [remainderSchedule, setRemainderSchedule] =
    useState<InvoiceRemainderScheduleConfig>(defaultInvoiceRemainderSchedule(""));
  const [termsAndConditions, setTermsAndConditions] = useState("");
  const [salesPersonId, setSalesPersonId] = useState<number | null>(null);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [lines, setLines] = useState<InvoiceLineDraft[]>([]);
  const [pendingAction, setPendingAction] = useState<InvoiceCreateAction | null>(
    null,
  );
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [paymentSetupOpen, setPaymentSetupOpen] = useState(false);
  const [chargeDialogOpen, setChargeDialogOpen] = useState(false);
  const [savedInvoice, setSavedInvoice] = useState<ClientInvoice | null>(null);

  const { data: invoice, isPending, error } = useGetOne<ClientInvoice>(
    "client_invoices",
    { id },
    { enabled: Boolean(id) },
  );

  const { data: lineItems = [], isPending: linesPending } =
    useGetList<ClientInvoiceLineItem>(
      "client_invoice_line_items",
      {
        filter: { "invoice_id@eq": id },
        pagination: { page: 1, perPage: 100 },
        sort: { field: "sort_order", order: "ASC" },
      },
      { enabled: Boolean(id) },
    );

  const { data: company } = useGetOne<Company>(
    "companies",
    { id: invoice?.company_id ?? "" },
    { enabled: Boolean(invoice?.company_id) },
  );

  const { data: contact } = useGetOne<Contact>(
    "contacts",
    { id: invoice?.contact_id ?? "" },
    { enabled: Boolean(invoice?.contact_id) },
  );

  const editable = invoice ? canEditClientInvoice(invoice) : false;

  useEffect(() => {
    setHydrated(false);
  }, [id]);

  useEffect(() => {
    if (!invoice || linesPending || hydrated) return;

    const subtotal = Number(invoice.subtotal ?? invoice.amount) || 0;
    const discountAmount = Number(invoice.discount_amount) || 0;

    setBillTo(billToSelectionFromClient({ company, contact }));
    setIssueDate(invoice.issue_date);
    setTerms(invoice.terms ?? "Net 30");
    setDueDate(invoice.due_date);
    setSaveCard(Boolean(invoice.save_card_for_future_charges));
    setPaymentMode(invoicePaymentModeFromRecord(invoice));
    setDepositPercent(
      Math.min(
        99,
        Math.max(1, Math.round(Number(invoice.upfront_percent ?? 50))),
      ),
    );
    setRemainderSchedule(
      parseInvoiceRemainderSchedule(
        invoice.remainder_schedule,
        invoice.due_date,
      ),
    );
    setTermsAndConditions(invoice.notes ?? "");
    setSalesPersonId(
      invoice.sales_person_id != null ? Number(invoice.sales_person_id) : null,
    );
    setDiscountPercent(discountPercentFromAmount(subtotal, discountAmount));

    const drafts = lineItemsToInvoiceDrafts(lineItems);
    setLines(
      drafts.length
        ? drafts
        : [
            {
              key: newInvoiceLineKey(),
              title: "",
              item_detail: "",
              quantity: 1,
              unit: "ea",
              unit_price: 0,
              sort_order: 0,
            },
          ],
    );
    setHydrated(true);
  }, [invoice, lineItems, linesPending, company, contact, hydrated]);

  useEffect(() => {
    if (hydrated) {
      setDueDate(dueDateFromTerms(issueDate, terms));
    }
  }, [issueDate, terms, hydrated]);

  const totals = useMemo(
    () => calculateInvoiceTotals(lines, discountPercent),
    [lines, discountPercent],
  );

  const onlinePaymentValue = useMemo(
    () => ({
      paymentMode,
      depositPercent,
      saveCard,
      remainderSchedule,
    }),
    [paymentMode, depositPercent, saveCard, remainderSchedule],
  );

  const buildLineItemsForPdf = (
    validLines: InvoiceLineDraft[],
    invoiceId: ClientInvoice["id"],
  ): ClientInvoiceLineItem[] =>
    validLines.map((line, index) => ({
      id: index,
      invoice_id: invoiceId,
      description: formatLineItemDescription(line),
      quantity: line.quantity,
      unit: line.unit,
      unit_price: line.unit_price,
      line_total: invoiceLineTotal(line.quantity, line.unit_price),
      sort_order: index,
    }));

  const saveMutation = useMutation({
    mutationFn: async (action: InvoiceCreateAction) => {
      setPendingAction(action);
      if (!invoice?.id) throw new Error("Missing invoice");
      if (!billTo?.companyId && !billTo?.contactId) {
        throw new Error("Select a client to bill");
      }
      const validLines = lines.filter((line) => line.title.trim());
      if (!validLines.length) {
        throw new Error("Add at least one line item with a title");
      }

      const updated = (await dataProvider.updateStandaloneClientInvoice(
        invoice.id,
        {
          company_id: billTo.companyId ?? contact?.company_id ?? null,
          contact_id: billTo.contactId ?? contact?.id ?? null,
          issue_date: issueDate,
          due_date: dueDate,
          terms,
          subtotal: totals.subtotal,
          discount_amount: totals.discountAmount,
          fee_amount: totals.feeAmount,
          amount: totals.total,
          description: defaultInvoiceDescription(validLines),
          notes: termsAndConditions.trim() || null,
          sales_person_id: salesPersonId,
          save_card_for_future_charges:
            paymentMode === "deposit_auto" || saveCard,
          upfront_percent: upfrontPercentFromMode(paymentMode, depositPercent),
          auto_charge_remainder: paymentMode === "deposit_auto",
          remainder_schedule:
            paymentMode === "deposit_auto" ? remainderSchedule : null,
          line_items: validLines.map((line, index) => ({
            description: formatLineItemDescription(line),
            quantity: line.quantity,
            unit: line.unit,
            unit_price: line.unit_price,
            package_id: line.package_id ?? null,
            addon_id: line.addon_id ?? null,
            sort_order: index,
          })),
        },
      )) as ClientInvoice;

      const lineItemsForPdf = buildLineItemsForPdf(validLines, updated.id);
      const pdfContext = buildClientInvoicePdfContext({
        invoice: updated,
        organizationName,
        organizationAddress,
        organizationWebsite: companyWebsite,
        company,
        contact,
        lineItems: lineItemsForPdf,
        billToEmail: resolveInvoiceRecipientEmail({ company, contact }),
      });

      if (action === "share") {
        const result = await dataProvider.shareClientInvoice({
          invoiceId: updated.id,
          baseUrl: window.location.origin,
        });
        const shareLink =
          result.short_url?.startsWith("http") || result.url?.startsWith("http")
            ? result.short_url || result.url
            : `${window.location.origin}${result.short_url || result.url}`;
        return { action, invoice: updated, shareUrl: shareLink };
      }

      if (action === "print") {
        await downloadClientInvoicePdf(pdfContext);
        return { action, invoice: updated };
      }

      return { action, invoice: updated };
    },
    onSuccess: ({ action, invoice: updated, shareUrl: link }) => {
      setSavedInvoice(updated);

      if (action === "draft") {
        notify("Invoice saved", { type: "success" });
        refresh();
        return;
      }

      if (action === "send_later") {
        setScheduleDialogOpen(true);
        notify("Invoice saved", { type: "success" });
        return;
      }

      if (action === "send") {
        setSendDialogOpen(true);
        notify("Invoice saved", { type: "success" });
        return;
      }

      if (action === "share" && link) {
        setShareUrl(link);
        setShareDialogOpen(true);
        notify("Invoice saved", { type: "success" });
        return;
      }

      if (action === "print") {
        notify("Invoice saved and PDF downloaded", { type: "success" });
        refresh();
      }
    },
    onError: (err: Error) => {
      notify(err.message || "Could not update invoice", { type: "error" });
    },
    onSettled: () => {
      setPendingAction(null);
    },
  });

  const handleSendComplete = () => {
    setSendDialogOpen(false);
    refresh();
  };

  const handleShareClose = (open: boolean) => {
    setShareDialogOpen(open);
    if (!open) refresh();
  };

  const dialogInvoice = savedInvoice ?? invoice;

  const scheduleLineItems = useMemo(() => {
    if (!dialogInvoice?.id) return [];
    const validLines = lines.filter((line) => line.title.trim());
    return buildLineItemsForPdf(validLines, dialogInvoice.id);
  }, [dialogInvoice, lines]);

  const handleScheduleClose = (open: boolean) => {
    setScheduleDialogOpen(open);
    if (!open) refresh();
  };

  if (isPending || linesPending || !hydrated) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading invoice…
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-sm text-muted-foreground">
        <p>Invoice not found.</p>
        <Button type="button" variant="outline" asChild>
          <Link to="/billing">Back to Billing</Link>
        </Button>
      </div>
    );
  }

  if (!editable && !embedded) {
    return <Navigate to={`/billing?invoice=${encodeURIComponent(id)}`} replace />;
  }

  const statusRibbon =
    invoice.status === "draft"
      ? "Draft"
      : invoiceStatusLabel(invoice.status, invoice.due_date);

  const shellClass = embedded
    ? "flex min-h-0 flex-1 flex-col"
    : "flex min-h-0 flex-1 flex-col bg-slate-100/80";

  const previewTotals = calculateInvoiceTotals(lines, discountPercent);

  if (embedded && !editable) {
    return (
      <div className={shellClass}>
        <div className="shrink-0 border-b bg-background px-3 py-2.5 md:px-4">
          <PageActions>
            <PageTitle label={invoice.invoice_number} />
            <Badge
              variant={invoiceStatusVariant(invoice.status, invoice.due_date)}
              className="ml-auto capitalize"
            >
              {invoiceStatusLabel(invoice.status, invoice.due_date)}
            </Badge>
          </PageActions>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-4">
          <InvoiceDocumentPreview
            organizationName={organizationName}
            organizationWebsite={companyWebsite}
            organizationAddress={organizationAddress}
            invoiceNumber={invoice.invoice_number}
            status={invoice.status}
            issueDate={issueDate}
            dueDate={dueDate}
            terms={terms}
            company={company}
            contact={contact}
            lines={lines}
            termsAndConditions={termsAndConditions}
            subtotal={previewTotals.subtotal}
            discountAmount={previewTotals.discountAmount}
            feeAmount={previewTotals.feeAmount}
            total={previewTotals.total}
            balanceDue={computeInvoiceBalanceDue(
              previewTotals.total,
              Number(invoice.amount_paid) || 0,
            )}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <div className="shrink-0 border-b bg-background px-3 py-2.5 md:px-4">
        <PageActions>
          <PageTitle label={invoice.invoice_number} />
          <InvoiceCreateActions
            isPending={saveMutation.isPending}
            pendingAction={pendingAction}
            onAction={(action) => saveMutation.mutate(action)}
            cancelTo="/billing"
            showCancel={!embedded}
            onConfigurePayment={() => setPaymentSetupOpen(true)}
            showCharge={invoice ? canChargeClientInvoice(invoice) : false}
            onCharge={() => setChargeDialogOpen(true)}
            chargeDisabled={saveMutation.isPending}
          />
        </PageActions>
      </div>

      <InvoiceOnlinePaymentSetupDialog
        open={paymentSetupOpen}
        onOpenChange={setPaymentSetupOpen}
        total={totals.total}
        issueDate={issueDate}
        dueDate={dueDate}
        value={onlinePaymentValue}
        onApply={(next) => {
          setPaymentMode(next.paymentMode);
          setDepositPercent(next.depositPercent);
          setSaveCard(next.saveCard);
          setRemainderSchedule(next.remainderSchedule);
        }}
      />

      <div
        className={
          embedded
            ? "min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-4"
            : "min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-6"
        }
      >
        <InlineInvoiceEditor
          organizationName={organizationName}
          organizationWebsite={companyWebsite}
          organizationAddress={organizationAddress}
          billTo={billTo}
          onBillToChange={setBillTo}
          issueDate={issueDate}
          onIssueDateChange={setIssueDate}
          terms={terms}
          onTermsChange={setTerms}
          dueDate={dueDate}
          onDueDateChange={setDueDate}
          salesPersonId={salesPersonId}
          onSalesPersonChange={setSalesPersonId}
          discountPercent={discountPercent}
          onDiscountPercentChange={setDiscountPercent}
          lines={lines}
          onLinesChange={setLines}
          saveCard={saveCard}
          onSaveCardChange={setSaveCard}
          paymentMode={paymentMode}
          onPaymentModeChange={setPaymentMode}
          depositPercent={depositPercent}
          onDepositPercentChange={setDepositPercent}
          remainderSchedule={remainderSchedule}
          onRemainderScheduleChange={setRemainderSchedule}
          termsAndConditions={termsAndConditions}
          onTermsAndConditionsChange={setTermsAndConditions}
          company={company}
          contact={contact}
          invoiceNumber={invoice.invoice_number}
          amountPaid={Number(invoice.amount_paid) || 0}
          documentRibbon={statusRibbon}
          paymentMethodBrand={invoice.payment_method_brand}
          paymentMethodLast4={invoice.payment_method_last4}
          autoChargeRemainder={Boolean(invoice.auto_charge_remainder)}
        />
      </div>

      <SendInvoiceDialog
        open={sendDialogOpen}
        onOpenChange={(open) => {
          setSendDialogOpen(open);
          if (!open) refresh();
        }}
        invoice={dialogInvoice}
        organizationName={organizationName}
        company={company}
        contact={contact}
        onSent={handleSendComplete}
      />

      <InvoiceShareLinkDialog
        open={shareDialogOpen}
        onOpenChange={handleShareClose}
        shareUrl={shareUrl}
        invoiceNumber={dialogInvoice.invoice_number}
      />

      <ScheduleInvoiceSendDialog
        open={scheduleDialogOpen}
        onOpenChange={handleScheduleClose}
        invoice={dialogInvoice}
        organizationName={organizationName}
        company={company}
        contact={contact}
        lineItems={scheduleLineItems}
        onScheduled={() => refresh()}
      />

      {invoice && canChargeClientInvoice(invoice) ? (
        <InvoiceStaffChargeDialog
          invoice={invoice}
          company={company}
          contact={contact}
          open={chargeDialogOpen}
          onOpenChange={setChargeDialogOpen}
          onSuccess={() => refresh()}
        />
      ) : null}
    </div>
  );
};
