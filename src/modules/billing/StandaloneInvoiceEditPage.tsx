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
import { buildSubscriptionDetailSearchParams } from "@/modules/billing/subscriptions/billingNavigation";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { Company, Contact } from "@/components/atomic-crm/types";
import {
  PageActions,
  PageTitle,
} from "@/components/atomic-crm/layout/PageActions";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import { type BillToSelection } from "@/modules/billing/BillToClientSearch";
import {
  InvoiceDetailToolbar,
  type InvoiceSendChannel,
} from "@/modules/billing/InvoiceDetailToolbar";
import { type InvoiceCreateAction } from "@/modules/billing/InvoiceCreateActions";
import { InvoiceShareLinkDialog } from "@/modules/billing/InvoiceShareLinkDialog";
import { InlineInvoiceEditor } from "@/modules/billing/InlineInvoiceEditor";
import { InvoiceOnlinePaymentSetupDialog } from "@/modules/billing/InvoiceOnlinePaymentSetupDialog";
import { ScheduleInvoiceSendDialog } from "@/modules/billing/ScheduleInvoiceSendDialog";
import { InvoiceStaffChargeDialog } from "@/modules/billing/InvoiceStaffChargeDialog";
import { SendInvoiceDialog } from "@/modules/billing/SendInvoiceDialog";
import {
  billToSelectionFromClient,
  canEditClientInvoice,
  canViewClientInvoiceDetail,
  resolveInvoiceRecipientEmail,
} from "@/modules/billing/billingUtils";
import { buildInvoiceDetailPaymentRows } from "@/modules/billing/invoiceDetailPayments";
import { InvoicePaymentsReceivedPanel } from "@/modules/billing/InvoicePaymentsReceivedPanel";
import {
  buildClientInvoicePdfContext,
  downloadClientInvoicePdf,
} from "@/modules/billing/clientInvoicePdf";
import {
  resolveInvoiceBalanceDue,
  resolveInvoiceDisplayTotals,
} from "@/modules/billing/invoiceDisplayTotals";
import {
  defaultInvoiceDescription,
  discountPercentFromAmount,
  dueDateFromTerms,
  formatLineItemDescription,
  invoiceLineTotal,
  lineItemsToInvoiceDrafts,
  newInvoiceLineKey,
  type InvoiceLineDraft,
} from "@/modules/billing/invoiceLineUtils";
import {
  invoicePaymentModeFromRecord,
  upfrontPercentFromMode,
  canChargeClientInvoice,
  type InvoicePaymentCollectionMode,
} from "@/modules/billing/invoicePaymentUtils";
import {
  defaultInvoiceRemainderSchedule,
  parseInvoiceRemainderSchedule,
  type InvoiceRemainderScheduleConfig,
} from "@/modules/billing/invoiceRemainderSchedule";
import {
  invoiceStatusLabel,
  invoiceStatusVariant,
  isClientInvoiceOverdue,
} from "@/modules/billing/billingDisplayUtils";
import { invoiceHasRecordedPayment } from "@/modules/clients/clientFinancialPayments";
import { InvoiceDocumentPreview } from "@/modules/billing/InvoiceDocumentPreview";
import { resolveInvoiceOrganizationName } from "@/modules/billing/invoiceEmailTemplate";
import { getInvoiceOrganizationBranding } from "@/modules/billing/invoiceOrganizationInfo";
import type {
  ClientInvoice,
  ClientInvoiceAutoChargeLog,
  ClientInvoiceLineItem,
} from "@/modules/types";
import { TicketInvoiceEditReasonDialog } from "@/modules/tickets/TicketInvoiceEditReasonDialog";
import { postInvoiceUpdateTicketNote } from "@/modules/tickets/postInvoiceUpdateTicketNote";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type StandaloneInvoiceEditPageProps = {
  /** Render inside the billing invoice sidebar workspace. */
  embedded?: boolean;
  /** When embedded, pass the invoice id directly instead of reading from the URL. */
  invoiceId?: string;
  /** Called after a successful save when embedded (e.g. ticket invoice edit). */
  onSaved?: (invoice: ClientInvoice) => void | Promise<void>;
  /** Pre-collected edit reason (e.g. ticket view dialog already asked). */
  initialEditReason?: string | null;
};

export const StandaloneInvoiceEditPage = ({
  embedded = false,
  invoiceId: invoiceIdProp,
  onSaved,
  initialEditReason = null,
}: StandaloneInvoiceEditPageProps = {}) => {
  const { id: routeId = "" } = useParams();
  const id = invoiceIdProp ?? routeId;
  const navigate = useNavigate();
  const notify = useNotify();
  const refresh = useRefresh();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { title, companyLegalName } = useConfigurationContext();

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
    useState<InvoiceRemainderScheduleConfig>(
      defaultInvoiceRemainderSchedule(""),
    );
  const [termsAndConditions, setTermsAndConditions] = useState("");
  const [salesPersonId, setSalesPersonId] = useState<number | null>(null);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [lines, setLines] = useState<InvoiceLineDraft[]>([]);
  const [pendingAction, setPendingAction] =
    useState<InvoiceCreateAction | null>(null);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [paymentSetupOpen, setPaymentSetupOpen] = useState(false);
  const [chargeDialogOpen, setChargeDialogOpen] = useState(false);
  const [savedInvoice, setSavedInvoice] = useState<ClientInvoice | null>(null);
  const [editReasonOpen, setEditReasonOpen] = useState(false);
  const [editReason, setEditReason] = useState<string | null>(
    initialEditReason,
  );
  const [editUnlocked, setEditUnlocked] = useState(false);
  const [pendingResend, setPendingResend] = useState(false);
  const [sendChannel, setSendChannel] = useState<InvoiceSendChannel>("both");

  const {
    data: invoice,
    isPending,
    error,
  } = useGetOne<ClientInvoice>(
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

  const billToCompanyId =
    billTo?.companyId ?? billTo?.contact?.company_id ?? null;
  const { data: billToCompany } = useGetOne<Company>(
    "companies",
    { id: billToCompanyId ?? "" },
    { enabled: Boolean(billToCompanyId) && !billTo?.company },
  );
  const activeCompany = billTo?.company ?? billToCompany ?? company ?? null;

  const billToContactId =
    billTo?.contactId ?? activeCompany?.primary_contact_id ?? null;
  const { data: billToContact } = useGetOne<Contact>(
    "contacts",
    { id: billToContactId ?? "" },
    { enabled: Boolean(billToContactId) && !billTo?.contact },
  );
  const activeContact = billTo?.contact ?? billToContact ?? contact ?? null;

  const editable = invoice ? canEditClientInvoice(invoice) : false;
  const isSentInvoice = invoice?.status === "sent";
  const isPaidInvoice = invoice?.status === "paid";
  const hasRecordedPayments = invoice
    ? invoiceHasRecordedPayment(invoice)
    : false;

  const { data: chargeLogs = [] } = useGetList<ClientInvoiceAutoChargeLog>(
    "client_invoice_auto_charge_logs",
    {
      filter: { "invoice_id@eq": id },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "attempted_at", order: "DESC" },
    },
    { enabled: Boolean(id) && hasRecordedPayments },
  );

  useEffect(() => {
    setHydrated(false);
    setPendingResend(false);
    setEditReason(initialEditReason);
  }, [id, initialEditReason]);

  useEffect(() => {
    if (!invoice) return;
    setEditUnlocked(
      invoice.status !== "sent" || Boolean(initialEditReason?.trim()),
    );
  }, [invoice?.id, invoice?.status, initialEditReason]);

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

  // Bill-to often loads after first hydrate; keep selection in sync without
  // overwriting an in-progress picker change once the user has a selection.
  useEffect(() => {
    if (!hydrated || !invoice) return;
    if (billTo?.companyId || billTo?.contactId) return;
    const next = billToSelectionFromClient({ company, contact });
    if (next) setBillTo(next);
  }, [
    hydrated,
    invoice,
    company,
    contact,
    billTo?.companyId,
    billTo?.contactId,
  ]);

  useEffect(() => {
    if (hydrated) {
      setDueDate(dueDateFromTerms(issueDate, terms));
    }
  }, [issueDate, terms, hydrated]);

  const totals = useMemo(
    () => resolveInvoiceDisplayTotals(invoice, lines, discountPercent),
    [invoice, lines, discountPercent],
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
      const resolvedCompanyId =
        billTo?.companyId ??
        activeCompany?.id ??
        invoice.company_id ??
        activeContact?.company_id ??
        null;
      const resolvedContactId =
        billTo?.contactId ??
        activeContact?.id ??
        invoice.contact_id ??
        null;
      if (!resolvedCompanyId && !resolvedContactId) {
        throw new Error("Select a client to bill");
      }
      const validLines = lines.filter((line) => line.title.trim());
      if (!validLines.length) {
        throw new Error("Add at least one line item with a title");
      }

      const updated = (await dataProvider.updateStandaloneClientInvoice(
        invoice.id,
        {
          company_id: resolvedCompanyId,
          contact_id: resolvedContactId,
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
        company: activeCompany,
        contact: activeContact,
        lineItems: lineItemsForPdf,
        billToEmail: resolveInvoiceRecipientEmail({
          company: activeCompany,
          contact: activeContact,
        }),
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
    onSuccess: async ({ action, invoice: updated, shareUrl: link }) => {
      setSavedInvoice(updated);

      const notifyTicketUpdate = async () => {
        if (!editReason?.trim() || !updated.ticket_id) return;
        try {
          await postInvoiceUpdateTicketNote(dataProvider, {
            ticketId: updated.ticket_id,
            invoiceNumber: updated.invoice_number,
            reason: editReason.trim(),
          });
        } catch {
          // Non-blocking — invoice save already succeeded
        }
      };

      if (action === "draft" || action === "update") {
        const message =
          action === "update" ? "Invoice updated" : "Invoice saved";
        notify(message, { type: "success" });
        if (action === "update") {
          setPendingResend(true);
          await notifyTicketUpdate();
        }
        refresh();
        if (embedded && onSaved) {
          await onSaved(updated);
        }
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
    setPendingResend(false);
    refresh();
  };

  const handleSendWithChannel = (channel: InvoiceSendChannel) => {
    setSendChannel(channel);
    if (isSentInvoice && !pendingResend) {
      setSendDialogOpen(true);
      return;
    }
    saveMutation.mutate("send");
  };

  const resendReceiptMutation = useMutation({
    mutationFn: () =>
      dataProvider.resendClientInvoicePaymentReceipt({
        invoiceId: invoice?.id ?? "",
        force: true,
      }),
    onSuccess: (result) => {
      notify(
        result?.already_sent
          ? "Payment receipt was already sent for this payment"
          : "Payment receipt sent",
        { type: "success" },
      );
    },
    onError: (error: Error) => {
      notify(error.message || "Could not send payment receipt", {
        type: "error",
      });
    },
  });

  const handleInvoiceDeleted = () => {
    if (embedded) {
      refresh();
      return;
    }
    navigate("/billing");
  };

  const readOnlyActionMutation = useMutation({
    mutationFn: async (action: "print" | "share") => {
      if (!invoice?.id) throw new Error("Missing invoice");
      const validLines = lines.filter((line) => line.title.trim());
      const pdfContext = buildClientInvoicePdfContext({
        invoice,
        organizationName,
        organizationAddress,
        organizationWebsite: companyWebsite,
        company: activeCompany,
        contact: activeContact,
        lineItems: buildLineItemsForPdf(validLines, invoice.id),
        billToEmail: resolveInvoiceRecipientEmail({
          company: activeCompany,
          contact: activeContact,
        }),
      });

      if (action === "print") {
        await downloadClientInvoicePdf(pdfContext);
        return { action };
      }

      const result = await dataProvider.shareClientInvoice({
        invoiceId: invoice.id,
        baseUrl: window.location.origin,
      });
      const shareLink =
        result.short_url?.startsWith("http") || result.url?.startsWith("http")
          ? result.short_url || result.url
          : `${window.location.origin}${result.short_url || result.url}`;
      return { action, shareUrl: shareLink };
    },
    onSuccess: ({ action, shareUrl: link }) => {
      if (action === "print") {
        notify("PDF downloaded", { type: "success" });
        return;
      }
      if (link) {
        setShareUrl(link);
        setShareDialogOpen(true);
      }
    },
    onError: (error: Error) => {
      notify(error.message || "Could not complete action", { type: "error" });
    },
  });

  const handleInvoiceAction = (action: InvoiceCreateAction) => {
    if (action === "resend") {
      setSendDialogOpen(true);
      return;
    }
    // Sent/paid invoices already have a client on the record — share/print
    // must not require re-saving the form (avoids false "Select a client").
    if (
      (isSentInvoice || isPaidInvoice) &&
      (action === "print" || action === "share")
    ) {
      readOnlyActionMutation.mutate(action);
      return;
    }
    saveMutation.mutate(action);
  };

  const invoiceBalanceDue = useMemo(
    () => (invoice ? resolveInvoiceBalanceDue(invoice, totals) : 0),
    [invoice, totals],
  );

  const showResendReceipt =
    Boolean(invoice) &&
    Number(invoice?.amount_paid ?? 0) > 0 &&
    invoice?.status !== "void";

  const paymentRows = useMemo(
    () => (invoice ? buildInvoiceDetailPaymentRows(invoice, chargeLogs) : []),
    [invoice, chargeLogs],
  );
  const showPaymentsReceived = paymentRows.length > 0;

  const paymentsReceivedPanel =
    invoice && showPaymentsReceived ? (
      <InvoicePaymentsReceivedPanel
        invoice={invoice}
        rows={paymentRows}
        onResendReceipt={
          showResendReceipt ? () => resendReceiptMutation.mutate() : undefined
        }
        resendPending={resendReceiptMutation.isPending}
      />
    ) : null;

  const invoiceToolbar = invoice ? (
    <InvoiceDetailToolbar
      invoice={invoice}
      isPending={
        saveMutation.isPending ||
        resendReceiptMutation.isPending ||
        readOnlyActionMutation.isPending
      }
      pendingAction={pendingAction}
      onAction={handleInvoiceAction}
      onSendWithChannel={handleSendWithChannel}
      onEdit={() => setEditReasonOpen(true)}
      editLocked={isSentInvoice && !editUnlocked}
      onScheduleSend={() => setScheduleDialogOpen(true)}
      cancelTo="/billing"
      showCancel={!embedded}
      onConfigurePayment={() => setPaymentSetupOpen(true)}
      showCharge={canChargeClientInvoice(invoice)}
      onCharge={() => setChargeDialogOpen(true)}
      balanceDue={invoiceBalanceDue}
      showResendReceipt={showResendReceipt}
      onResendReceipt={() => resendReceiptMutation.mutate()}
      pendingResend={pendingResend}
      onRefresh={() => refresh()}
      onDeleted={handleInvoiceDeleted}
    />
  ) : null;

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
        <Button type="button" variant="secondary" asChild>
          <Link to="/billing">Back to Billing</Link>
        </Button>
      </div>
    );
  }

  if (!canViewClientInvoiceDetail(invoice) && !embedded) {
    return (
      <Navigate to={`/billing?invoice=${encodeURIComponent(id)}`} replace />
    );
  }

  const statusRibbon =
    invoice.status === "draft"
      ? "Draft"
      : isClientInvoiceOverdue(invoice)
        ? "Overdue"
        : invoiceStatusLabel(invoice.status, invoice.due_date);

  const shellClass = embedded
    ? "flex flex-col"
    : "flex min-h-0 flex-1 flex-col bg-muted/50";

  const showSentEditGate = isSentInvoice && editable && !editUnlocked;
  const showReadOnlyDocument = isPaidInvoice || showSentEditGate;

  // Embedded: parent workspace/dialog owns scroll (avoid nested overflow trap).
  const bodyClass = embedded
    ? "px-3 py-4 md:px-4"
    : "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 md:px-6";

  if (embedded && !canViewClientInvoiceDetail(invoice)) {
    return (
      <div className={shellClass}>
        <div className="shrink-0 border-b bg-background px-3 py-2.5 md:px-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-base font-semibold">
              {invoice.invoice_number}
            </h2>
            <Badge
              variant={invoiceStatusVariant(invoice.status, invoice.due_date)}
              className="ml-auto capitalize"
            >
              {invoiceStatusLabel(invoice.status, invoice.due_date)}
            </Badge>
          </div>
        </div>
        <div className={bodyClass}>
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
            invoice={invoice}
            subtotal={totals.subtotal}
            discountAmount={totals.discountAmount}
            feeAmount={totals.feeAmount}
            total={totals.total}
            balanceDue={invoiceBalanceDue}
          />
        </div>
      </div>
    );
  }

  const headerInner = (
    <>
      {embedded ? (
        <div className="space-y-1">
          <h2 className="text-base font-semibold">{invoice.invoice_number}</h2>
          {invoice.subscription_id ? (
            <Link
              to={`/billing?${buildSubscriptionDetailSearchParams(String(invoice.subscription_id)).toString()}`}
              className="text-sm text-primary hover:underline"
            >
              View subscription
            </Link>
          ) : null}
        </div>
      ) : (
        <PageTitle label={invoice.invoice_number} />
      )}
      <div className="w-full min-w-0">{invoiceToolbar}</div>
    </>
  );

  return (
    <div className={shellClass}>
      <div className="shrink-0 border-b bg-background px-3 py-2.5 md:px-4">
        {embedded ? (
          <div className="flex flex-col gap-3">{headerInner}</div>
        ) : (
          <PageActions>
            <div className="flex w-full min-w-0 flex-col gap-3">
              {headerInner}
            </div>
          </PageActions>
        )}
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

      <div className={bodyClass}>
        {showReadOnlyDocument ? (
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
            {paymentsReceivedPanel}
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
              invoice={invoice}
              subtotal={totals.subtotal}
              discountAmount={totals.discountAmount}
              feeAmount={totals.feeAmount}
              total={totals.total}
              balanceDue={invoiceBalanceDue}
            />
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
            {paymentsReceivedPanel}
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
              company={activeCompany}
              contact={activeContact}
              invoiceNumber={invoice.invoice_number}
              amountPaid={Number(invoice.amount_paid) || 0}
              invoice={invoice}
              documentRibbon={statusRibbon}
              paymentMethodBrand={invoice.payment_method_brand}
              paymentMethodLast4={invoice.payment_method_last4}
              autoChargeRemainder={Boolean(invoice.auto_charge_remainder)}
            />
          </div>
        )}
      </div>

      <TicketInvoiceEditReasonDialog
        open={editReasonOpen}
        invoiceNumber={invoice.invoice_number}
        onOpenChange={setEditReasonOpen}
        onConfirm={(reason) => {
          setEditReason(reason);
          setEditUnlocked(true);
        }}
      />

      <SendInvoiceDialog
        open={sendDialogOpen}
        onOpenChange={(open) => {
          setSendDialogOpen(open);
          if (!open) refresh();
        }}
        invoice={dialogInvoice}
        organizationName={organizationName}
        company={activeCompany}
        contact={activeContact}
        onSent={handleSendComplete}
        onScheduleSend={() => {
          setScheduleDialogOpen(true);
          refresh();
        }}
        onShareLink={(url) => {
          setShareUrl(url);
          setShareDialogOpen(true);
          refresh();
        }}
        deliveryChannel={sendChannel}
      />

      <InvoiceShareLinkDialog
        open={shareDialogOpen}
        onOpenChange={handleShareClose}
        shareUrl={shareUrl}
        invoice={dialogInvoice}
        invoiceNumber={dialogInvoice.invoice_number}
        organizationName={organizationName}
        company={activeCompany}
        contact={activeContact}
      />

      <ScheduleInvoiceSendDialog
        open={scheduleDialogOpen}
        onOpenChange={handleScheduleClose}
        invoice={dialogInvoice}
        organizationName={organizationName}
        company={activeCompany}
        contact={activeContact}
        lineItems={scheduleLineItems}
        onScheduled={() => refresh()}
      />

      {invoice && canChargeClientInvoice(invoice) ? (
        <InvoiceStaffChargeDialog
          invoice={invoice}
          company={activeCompany}
          contact={activeContact}
          open={chargeDialogOpen}
          onOpenChange={setChargeDialogOpen}
          onSuccess={() => refresh()}
        />
      ) : null}
    </div>
  );
};
