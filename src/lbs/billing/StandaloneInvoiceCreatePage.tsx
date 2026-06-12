import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useDataProvider, useGetIdentity, useGetOne, useNotify } from "ra-core";
import { useNavigate } from "react-router";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { Contact } from "@/components/atomic-crm/types";
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
import { ScheduleInvoiceSendDialog } from "@/lbs/billing/ScheduleInvoiceSendDialog";
import { InlineInvoiceEditor } from "@/lbs/billing/InlineInvoiceEditor";
import { InvoiceOnlinePaymentSetupDialog } from "@/lbs/billing/InvoiceOnlinePaymentSetupDialog";
import { SendInvoiceDialog } from "@/lbs/billing/SendInvoiceDialog";
import { resolveInvoiceRecipientEmail } from "@/lbs/billing/billingUtils";
import {
  buildClientInvoicePdfContext,
  downloadClientInvoicePdf,
} from "@/lbs/billing/clientInvoicePdf";
import {
  calculateInvoiceTotals,
  DEFAULT_INVOICE_TERMS_AND_CONDITIONS,
  defaultInvoiceDescription,
  dueDateFromTerms,
  formatLineItemDescription,
  invoiceLineTotal,
  newInvoiceLineKey,
  type InvoiceLineDraft,
} from "@/lbs/billing/invoiceLineUtils";
import {
  upfrontPercentFromMode,
  type InvoicePaymentCollectionMode,
} from "@/lbs/billing/invoicePaymentUtils";
import {
  defaultInvoiceRemainderSchedule,
  type InvoiceRemainderScheduleConfig,
} from "@/lbs/billing/invoiceRemainderSchedule";
import {
  resolveInvoiceOrganizationName,
} from "@/lbs/billing/invoiceEmailTemplate";
import { getInvoiceOrganizationBranding } from "@/lbs/billing/invoiceOrganizationInfo";
import type { ClientInvoice, ClientInvoiceLineItem } from "@/lbs/types";

export const StandaloneInvoiceCreatePage = () => {
  const navigate = useNavigate();
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { data: identity } = useGetIdentity();
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

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [billTo, setBillTo] = useState<BillToSelection | null>(null);
  const [issueDate, setIssueDate] = useState(today);
  const [terms, setTerms] = useState<string>("Net 30");
  const [dueDate, setDueDate] = useState(dueDateFromTerms(today, "Net 30"));
  const [saveCard, setSaveCard] = useState(true);
  const [paymentMode, setPaymentMode] =
    useState<InvoicePaymentCollectionMode>("full");
  const [depositPercent, setDepositPercent] = useState(50);
  const [remainderSchedule, setRemainderSchedule] =
    useState<InvoiceRemainderScheduleConfig>(() =>
      defaultInvoiceRemainderSchedule(dueDateFromTerms(today, "Net 30")),
    );
  const [termsAndConditions, setTermsAndConditions] = useState(
    DEFAULT_INVOICE_TERMS_AND_CONDITIONS,
  );
  const [salesPersonId, setSalesPersonId] = useState<number | null>(null);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [lines, setLines] = useState<InvoiceLineDraft[]>([
    {
      key: newInvoiceLineKey(),
      title: "",
      item_detail: "",
      quantity: 1,
      unit: "ea",
      unit_price: 0,
      sort_order: 0,
    },
  ]);
  const [pendingAction, setPendingAction] = useState<InvoiceCreateAction | null>(
    null,
  );
  const [createdInvoice, setCreatedInvoice] = useState<ClientInvoice | null>(
    null,
  );
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [paymentSetupOpen, setPaymentSetupOpen] = useState(false);

  const companyId = billTo?.companyId ?? billTo?.contact?.company_id ?? null;
  const { data: companyFromContact } = useGetOne(
    "companies",
    { id: companyId ?? "" },
    { enabled: Boolean(companyId) && !billTo?.company },
  );

  const company = billTo?.company ?? companyFromContact ?? null;

  const primaryContactId =
    billTo?.contactId ?? company?.primary_contact_id ?? null;

  const { data: primaryContact } = useGetOne<Contact>(
    "contacts",
    { id: primaryContactId ?? "" },
    { enabled: Boolean(primaryContactId) && !billTo?.contact },
  );

  const contact = billTo?.contact ?? primaryContact ?? null;

  useEffect(() => {
    setDueDate(dueDateFromTerms(issueDate, terms));
    setRemainderSchedule((prev) => ({
      ...prev,
      project_end_date: prev.project_end_date ?? dueDateFromTerms(issueDate, terms),
    }));
  }, [issueDate, terms]);

  useEffect(() => {
    if (identity?.id != null && salesPersonId == null) {
      setSalesPersonId(Number(identity.id));
    }
  }, [identity?.id, salesPersonId]);

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

  const createMutation = useMutation({
    mutationFn: async (action: InvoiceCreateAction) => {
      setPendingAction(action);
      if (!billTo?.companyId && !billTo?.contactId) {
        throw new Error("Select a client to bill");
      }
      const validLines = lines.filter((line) => line.title.trim());
      if (!validLines.length) {
        throw new Error("Add at least one line item with a title");
      }

      const invoice = (await dataProvider.createStandaloneClientInvoice({
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
      })) as ClientInvoice;

      const lineItems = buildLineItemsForPdf(validLines, invoice.id);
      const pdfContext = buildClientInvoicePdfContext({
        invoice,
        organizationName,
        organizationAddress,
        organizationWebsite: companyWebsite,
        company,
        contact,
        lineItems,
        billToEmail: resolveInvoiceRecipientEmail({ company, contact }),
      });

      if (action === "share") {
        const result = await dataProvider.shareClientInvoice({
          invoiceId: invoice.id,
          baseUrl: window.location.origin,
        });
        const shareLink =
          result.short_url?.startsWith("http") || result.url?.startsWith("http")
            ? result.short_url || result.url
            : `${window.location.origin}${result.short_url || result.url}`;
        return { action, invoice, shareUrl: shareLink };
      }

      if (action === "print") {
        await downloadClientInvoicePdf(pdfContext);
        return { action, invoice };
      }

      return { action, invoice };
    },
    onSuccess: ({ action, invoice, shareUrl: link }) => {
      if (action === "draft") {
        notify("Invoice saved", { type: "success" });
        navigate(`/billing?invoice=${invoice.id}`);
        return;
      }

      if (action === "send_later") {
        setCreatedInvoice(invoice);
        setScheduleDialogOpen(true);
        notify("Invoice saved", { type: "success" });
        return;
      }

      if (action === "send") {
        setCreatedInvoice(invoice);
        setSendDialogOpen(true);
        notify("Invoice created", { type: "success" });
        return;
      }

      if (action === "share" && link) {
        setCreatedInvoice(invoice);
        setShareUrl(link);
        setShareDialogOpen(true);
        notify("Invoice created", { type: "success" });
        return;
      }

      if (action === "print") {
        notify("Invoice saved and PDF downloaded", { type: "success" });
        navigate(`/billing?invoice=${invoice.id}`);
      }
    },
    onError: (error: Error) => {
      notify(error.message || "Could not create invoice", { type: "error" });
    },
    onSettled: () => {
      setPendingAction(null);
    },
  });

  const handleSendComplete = () => {
    setSendDialogOpen(false);
    if (createdInvoice?.id) {
      navigate(`/billing?invoice=${createdInvoice.id}`);
    } else {
      navigate("/billing", { state: { tab: "invoices" } });
    }
  };

  const handleShareClose = (open: boolean) => {
    setShareDialogOpen(open);
    if (!open && createdInvoice?.id) {
      navigate(`/billing?invoice=${createdInvoice.id}`);
    }
  };

  const scheduleLineItems = useMemo(() => {
    if (!createdInvoice?.id) return [];
    const validLines = lines.filter((line) => line.title.trim());
    return buildLineItemsForPdf(validLines, createdInvoice.id);
  }, [createdInvoice, lines]);

  const handleScheduleClose = (open: boolean) => {
    setScheduleDialogOpen(open);
    if (!open && createdInvoice?.id) {
      navigate(`/billing?invoice=${createdInvoice.id}`);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-slate-100/80">
      <div className="border-b bg-background px-4 py-3 md:px-6">
        <PageActions>
          <PageTitle label="New invoice" />
          <InvoiceCreateActions
            isPending={createMutation.isPending}
            pendingAction={pendingAction}
            onAction={(action) => createMutation.mutate(action)}
            onConfigurePayment={() => setPaymentSetupOpen(true)}
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

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-6">
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
        />
      </div>

      <SendInvoiceDialog
        open={sendDialogOpen}
        onOpenChange={(open) => {
          setSendDialogOpen(open);
          if (!open && createdInvoice?.id) {
            navigate(`/billing?invoice=${createdInvoice.id}`);
          }
        }}
        invoice={createdInvoice}
        organizationName={organizationName}
        company={company}
        contact={contact}
        onSent={handleSendComplete}
      />

      <InvoiceShareLinkDialog
        open={shareDialogOpen}
        onOpenChange={handleShareClose}
        shareUrl={shareUrl}
        invoiceNumber={createdInvoice?.invoice_number}
      />

      <ScheduleInvoiceSendDialog
        open={scheduleDialogOpen}
        onOpenChange={handleScheduleClose}
        invoice={createdInvoice}
        organizationName={organizationName}
        company={company}
        contact={contact}
        lineItems={scheduleLineItems}
        onScheduled={() => {
          if (createdInvoice?.id) {
            navigate(`/billing?invoice=${createdInvoice.id}`);
          }
        }}
      />
    </div>
  );
};
