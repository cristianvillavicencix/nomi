import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDataProvider, useGetIdentity, useGetOne, useNotify } from "ra-core";
import { useNavigate, useSearchParams } from "react-router";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { Company, Contact } from "@/components/atomic-crm/types";
import {
  PageActions,
  PageTitle,
} from "@/components/atomic-crm/layout/PageActions";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import { type BillToSelection } from "@/modules/billing/BillToClientSearch";
import {
  InvoiceCreateActions,
  type InvoiceCreateAction,
} from "@/modules/billing/InvoiceCreateActions";
import { InvoiceShareLinkDialog } from "@/modules/billing/InvoiceShareLinkDialog";
import { ScheduleInvoiceSendDialog } from "@/modules/billing/ScheduleInvoiceSendDialog";
import { InlineInvoiceEditor } from "@/modules/billing/InlineInvoiceEditor";
import { InvoiceOnlinePaymentSetupDialog } from "@/modules/billing/InvoiceOnlinePaymentSetupDialog";
import { SendInvoiceDialog } from "@/modules/billing/SendInvoiceDialog";
import { resolveInvoiceRecipientEmail } from "@/modules/billing/billingUtils";
import {
  buildClientInvoicePdfContext,
  downloadClientInvoicePdf,
} from "@/modules/billing/clientInvoicePdf";
import {
  calculateInvoiceTotals,
  DEFAULT_INVOICE_TERMS_AND_CONDITIONS,
  defaultInvoiceDescription,
  dueDateFromTerms,
  formatLineItemDescription,
  invoiceLineTotal,
  newInvoiceLineKey,
  type InvoiceLineDraft,
} from "@/modules/billing/invoiceLineUtils";
import {
  upfrontPercentFromMode,
  type InvoicePaymentCollectionMode,
} from "@/modules/billing/invoicePaymentUtils";
import {
  defaultInvoiceRemainderSchedule,
  type InvoiceRemainderScheduleConfig,
} from "@/modules/billing/invoiceRemainderSchedule";
import { resolveInvoiceOrganizationName } from "@/modules/billing/invoiceEmailTemplate";
import { getInvoiceOrganizationBranding } from "@/modules/billing/invoiceOrganizationInfo";
import type { ClientInvoice, ClientInvoiceLineItem } from "@/modules/types";

export const StandaloneInvoiceCreatePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { data: identity } = useGetIdentity();
  const { title, companyLegalName } = useConfigurationContext();
  const prefillAppliedRef = useRef(false);

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
  const [pendingAction, setPendingAction] =
    useState<InvoiceCreateAction | null>(null);
  const [createdInvoice, setCreatedInvoice] = useState<ClientInvoice | null>(
    null,
  );
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [paymentSetupOpen, setPaymentSetupOpen] = useState(false);

  const prefillCompanyId = searchParams.get("company_id")?.trim() || "";
  const prefillContactId = searchParams.get("contact_id")?.trim() || "";

  const { data: prefillCompany } = useGetOne<Company>(
    "companies",
    { id: prefillCompanyId },
    { enabled: Boolean(prefillCompanyId) },
  );
  const { data: prefillContact } = useGetOne<Contact>(
    "contacts",
    { id: prefillContactId },
    { enabled: Boolean(prefillContactId) },
  );

  useEffect(() => {
    if (prefillAppliedRef.current || billTo) return;

    if (prefillCompanyId) {
      if (!prefillCompany) return;
      const contact =
        prefillContact &&
        String(prefillContact.company_id ?? "") === String(prefillCompany.id)
          ? prefillContact
          : null;
      setBillTo({
        companyId: Number(prefillCompany.id),
        contactId: contact
          ? Number(contact.id)
          : prefillCompany.primary_contact_id != null
            ? Number(prefillCompany.primary_contact_id)
            : null,
        label: prefillCompany.name,
        company: prefillCompany,
        contact,
      });
      prefillAppliedRef.current = true;
      return;
    }

    if (!prefillContactId || !prefillContact) return;

    setBillTo({
      companyId:
        prefillContact.company_id != null
          ? Number(prefillContact.company_id)
          : null,
      contactId: Number(prefillContact.id),
      label:
        [prefillContact.first_name, prefillContact.last_name]
          .filter(Boolean)
          .join(" ")
          .trim() || `Contact #${prefillContact.id}`,
      company: null,
      contact: prefillContact,
    });
    prefillAppliedRef.current = true;
  }, [
    billTo,
    prefillCompany,
    prefillCompanyId,
    prefillContact,
    prefillContactId,
  ]);

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
      project_end_date:
        prev.project_end_date ?? dueDateFromTerms(issueDate, terms),
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
    <div className="flex min-h-0 flex-1 flex-col bg-muted/50">
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
        onScheduleSend={() => {
          setScheduleDialogOpen(true);
        }}
        onShareLink={(url) => {
          setShareUrl(url);
          setShareDialogOpen(true);
        }}
      />

      <InvoiceShareLinkDialog
        open={shareDialogOpen}
        onOpenChange={handleShareClose}
        shareUrl={shareUrl}
        invoice={createdInvoice}
        invoiceNumber={createdInvoice?.invoice_number}
        organizationName={organizationName}
        company={company}
        contact={contact}
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
