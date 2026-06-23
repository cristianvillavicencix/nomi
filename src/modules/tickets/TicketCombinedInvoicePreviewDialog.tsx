import { useMutation } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Send,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useDataProvider,
  useGetIdentity,
  useGetList,
  useNotify,
  useRefresh,
} from "ra-core";
import type { Company, Contact } from "@/components/atomic-crm/types";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import { InvoiceDocumentPreview } from "@/modules/billing/InvoiceDocumentPreview";
import {
  formatInvoiceDueDate,
  resolveInvoiceOrganizationName,
} from "@/modules/billing/invoiceEmailTemplate";
import {
  formatOrganizationMemberName,
  resolveInvoiceRecipientPhone,
} from "@/modules/billing/billingUtils";
import { getInvoiceOrganizationBranding } from "@/modules/billing/invoiceOrganizationInfo";
import type {
  ClientInvoice,
  ClientInvoiceLineItem,
  Ticket,
  TicketDeliverable,
} from "@/modules/types";
import {
  buildCombinedInvoicePropertySummary,
  getCombinedTicketIds,
  sortTicketsForCombinedInvoice,
} from "@/modules/tickets/combinedTicketInvoiceUtils";
import {
  buildTicketSendFooterSummary,
  TicketInvoiceSendPreview,
} from "@/modules/tickets/TicketInvoiceSendPreview";
import {
  buildTicketPaymentEmailHtml,
  buildTicketPaymentSmsText,
  clientInvoiceLineItemsToDrafts,
  DEFAULT_TICKET_PAYMENT_EMAIL_MESSAGE,
  formatTicketInvoicePreviewMoney,
  resolveTicketSmsServiceSubject,
} from "@/modules/tickets/ticketInvoicePreview";
import { buildTicketPaymentCopyFromDeliverables } from "@/modules/tickets/ticketInvoiceCopy";
import { resolveTicketRequesterEmail } from "@/modules/tickets/ticketRequester";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatUsPhoneDisplayFromAny } from "@/utils/phone";
import { cn } from "@/lib/utils";

type PreviewStep = "invoice" | "email";

type TicketCombinedInvoicePreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tickets: Ticket[];
  companyById: Map<string, Company>;
  contactById: Map<string, Contact>;
  selectedRecipientEmail?: string;
  onInvoiceSent?: () => void;
};

const StepIndicator = ({ step }: { step: PreviewStep }) => (
  <div className="flex items-center gap-2 pt-2 text-sm">
    <span
      className={cn(
        "font-medium",
        step === "invoice" ? "text-foreground" : "text-muted-foreground",
      )}
    >
      1. Invoice
    </span>
    <ChevronRight className="size-4 text-muted-foreground" />
    <span
      className={cn(
        "font-medium",
        step === "email" ? "text-foreground" : "text-muted-foreground",
      )}
    >
      2. Email
    </span>
  </div>
);

export const TicketCombinedInvoicePreviewDialog = ({
  open,
  onOpenChange,
  tickets,
  companyById,
  contactById,
  selectedRecipientEmail = "",
  onInvoiceSent,
}: TicketCombinedInvoicePreviewDialogProps) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { identity } = useGetIdentity();
  const { title, companyLegalName } = useConfigurationContext();
  const [step, setStep] = useState<PreviewStep>("invoice");
  const [draftInvoice, setDraftInvoice] = useState<ClientInvoice | null>(null);
  const [lineItems, setLineItems] = useState<ClientInvoiceLineItem[]>([]);
  const [paymentUrl, setPaymentUrl] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [editingTo, setEditingTo] = useState(false);
  const [subject, setSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState(
    DEFAULT_TICKET_PAYMENT_EMAIL_MESSAGE,
  );
  const [deliverySubject, setDeliverySubject] = useState("");
  const [serviceLines, setServiceLines] = useState<string[]>([]);
  const [phone, setPhone] = useState("");
  const [sendSms, setSendSms] = useState(false);
  const sentRef = useRef(false);

  const sortedTickets = useMemo(
    () => sortTicketsForCombinedInvoice(tickets),
    [tickets],
  );
  const ticketIds = useMemo(
    () => getCombinedTicketIds(sortedTickets),
    [sortedTickets],
  );
  const primaryTicket = sortedTickets[0] ?? null;
  const company = primaryTicket?.company_id
    ? companyById.get(String(primaryTicket.company_id))
    : null;
  const contact = primaryTicket?.contact_id
    ? contactById.get(String(primaryTicket.contact_id))
    : null;

  const ticketIdFilter = ticketIds.length
    ? { "ticket_id@in": `(${ticketIds.join(",")})` }
    : undefined;

  const { data: deliverables = [] } = useGetList<TicketDeliverable>(
    "ticket_deliverables",
    {
      filter: ticketIdFilter,
      sort: { field: "sort_order", order: "ASC" },
      pagination: { page: 1, perPage: 100 },
    },
    { enabled: open && ticketIds.length > 0 },
  );

  const organizationName = useMemo(
    () => resolveInvoiceOrganizationName({ title, companyLegalName }),
    [title, companyLegalName],
  );
  const invoiceBranding = useMemo(() => getInvoiceOrganizationBranding(), []);
  const propertySummary = useMemo(
    () => buildCombinedInvoicePropertySummary(sortedTickets),
    [sortedTickets],
  );

  const unbilledDeliverables = useMemo(
    () => deliverables.filter((file) => !file.invoiced_invoice_id),
    [deliverables],
  );

  const applyPaymentCopy = (items: TicketDeliverable[]) => {
    const copy = buildTicketPaymentCopyFromDeliverables(items, propertySummary);
    setSubject(copy.subject);
    setEmailMessage(copy.message);
    setDeliverySubject(copy.deliverySubject);
    setServiceLines(copy.serviceLines);
  };

  const prepareMutation = useMutation({
    mutationFn: () =>
      dataProvider.prepareCombinedTicketInvoice({
        ticketIds,
        baseUrl: window.location.origin,
        recipientEmail: selectedRecipientEmail,
      }),
    onSuccess: (data) => {
      setDraftInvoice(data.invoice as ClientInvoice);
      setLineItems((data.line_items ?? []) as ClientInvoiceLineItem[]);
      setPaymentUrl(data.payment_url);
      setRecipientEmail(
        data.to ||
          (primaryTicket
            ? resolveTicketRequesterEmail(primaryTicket, company, contact)
            : "") ||
          "",
      );
      applyPaymentCopy(unbilledDeliverables);
      refresh();
    },
    onError: (error: Error) => {
      notify(error.message || "Could not prepare combined invoice", {
        type: "error",
      });
      onOpenChange(false);
    },
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      dataProvider.sendCombinedTicketInvoice({
        ticketIds,
        baseUrl: window.location.origin,
        message: emailMessage,
        subject: subject.trim(),
        smsTo: sendSms ? phone.trim() : undefined,
        sendSms,
        recipientEmail,
      }),
    onSuccess: () => {
      sentRef.current = true;
      notify("Combined invoice sent — files will deliver after payment", {
        type: "success",
      });
      onInvoiceSent?.();
      onOpenChange(false);
      refresh();
    },
    onError: (error: Error) =>
      notify(error.message || "Could not send combined invoice", {
        type: "error",
      }),
  });

  const cancelMutation = useMutation({
    mutationFn: () =>
      dataProvider.cancelCombinedTicketInvoiceDraft({ ticketIds }),
  });

  useEffect(() => {
    if (!open) return;
    sentRef.current = false;
    setStep("invoice");
    setEmailMessage(DEFAULT_TICKET_PAYMENT_EMAIL_MESSAGE);
    setSubject("");
    setDeliverySubject("");
    setServiceLines([]);
    const defaultPhone = resolveInvoiceRecipientPhone({ company, contact });
    setPhone(defaultPhone);
    setSendSms(Boolean(defaultPhone.trim()));
    setEditingTo(false);
    setDraftInvoice(null);
    setLineItems([]);
    setRecipientEmail(selectedRecipientEmail.trim());
    prepareMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- prepare when dialog opens
  }, [open, ticketIds.join(","), selectedRecipientEmail]);

  const previewLines = useMemo(
    () => clientInvoiceLineItemsToDrafts(lineItems),
    [lineItems],
  );

  const amountFormatted = draftInvoice
    ? formatTicketInvoicePreviewMoney(Number(draftInvoice.amount) || 0)
    : "—";

  const paymentEmailHtml =
    draftInvoice && paymentUrl
      ? buildTicketPaymentEmailHtml({
          orgName: organizationName,
          invoiceNumber: draftInvoice.invoice_number,
          amountFormatted,
          paymentUrl,
          customMessage: emailMessage,
          serviceLines,
        })
      : "";

  const paymentSmsText =
    draftInvoice && paymentUrl
      ? buildTicketPaymentSmsText({
          orgName: organizationName,
          paymentUrl,
          recipientFirstName: contact?.first_name,
          serviceSubject: resolveTicketSmsServiceSubject(
            unbilledDeliverables,
            propertySummary,
          ),
        })
      : "";

  const footerSummary =
    draftInvoice && amountFormatted !== "—"
      ? buildTicketSendFooterSummary(amountFormatted, draftInvoice.due_date)
      : "";

  const handleClose = (next: boolean) => {
    if (!next && open && !sentRef.current && draftInvoice?.status === "draft") {
      void cancelMutation.mutateAsync().then(() => {
        refresh();
        setStep("invoice");
        onOpenChange(false);
      });
      return;
    }
    if (!next) setStep("invoice");
    onOpenChange(next);
  };

  const isLoading = prepareMutation.isPending || !draftInvoice;
  const canSend =
    Boolean(recipientEmail.trim()) &&
    Boolean(subject.trim()) &&
    Boolean(paymentUrl) &&
    (!sendSms || Boolean(phone.trim()));

  const dialogWidthClass =
    step === "invoice"
      ? "sm:max-w-[min(96vw,calc(210mm+5rem))]"
      : "sm:max-w-[min(96vw,72rem)]";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className={cn(
          "flex max-h-[min(92vh,900px)] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0",
          dialogWidthClass,
        )}
      >
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {step === "invoice" ? "Review combined invoice" : "Send combined invoice"}
            {draftInvoice ? (
              <Badge variant="outline" className="font-mono text-xs font-normal">
                {draftInvoice.invoice_number}
              </Badge>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            {sortedTickets.length} tickets · one payment link ·{" "}
            {unbilledDeliverables.length} delivery file
            {unbilledDeliverables.length === 1 ? "" : "s"}
          </DialogDescription>
          <StepIndicator step={step} />
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />
              Preparing combined invoice…
            </div>
          ) : step === "invoice" ? (
            <InvoiceDocumentPreview
              organizationName={organizationName}
              organizationWebsite={invoiceBranding.website}
              organizationAddress={invoiceBranding.address}
              invoiceNumber={draftInvoice.invoice_number}
              status="draft"
              issueDate={draftInvoice.issue_date}
              dueDate={draftInvoice.due_date}
              terms={draftInvoice.terms ?? "Due on receipt"}
              company={company}
              contact={contact}
              lines={previewLines}
              subtotal={Number(draftInvoice.subtotal) || undefined}
              feeAmount={Number(draftInvoice.fee_amount) || undefined}
              total={Number(draftInvoice.amount) || 0}
              balanceDue={Number(draftInvoice.amount) || 0}
              termsAndConditions={draftInvoice.notes}
            />
          ) : (
            <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Amount due</p>
                    <p className="text-lg font-semibold tabular-nums">
                      {amountFormatted}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Due date</p>
                    <p className="text-sm font-semibold leading-tight">
                      {formatInvoiceDueDate(draftInvoice.due_date)}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="combined-invoice-send-to">To</Label>
                  <div className="rounded-md border px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                    {recipientEmail.trim() && !editingTo ? (
                      <div className="flex min-h-8 items-center gap-1">
                        <Badge
                          variant="secondary"
                          className="max-w-full gap-1 bg-primary/10 font-normal text-primary hover:bg-primary/15"
                        >
                          <span className="truncate">{recipientEmail}</span>
                          <button
                            type="button"
                            className="rounded-sm opacity-70 hover:opacity-100"
                            aria-label="Clear recipient email"
                            onClick={() => {
                              setRecipientEmail("");
                              setEditingTo(true);
                            }}
                          >
                            <X className="size-3" />
                          </button>
                        </Badge>
                      </div>
                    ) : (
                      <Input
                        id="combined-invoice-send-to"
                        type="email"
                        value={recipientEmail}
                        onChange={(event) => setRecipientEmail(event.target.value)}
                        onBlur={() => setEditingTo(false)}
                        className="h-8 border-0 px-1 shadow-none focus-visible:ring-0"
                        placeholder="Recipient email"
                        autoFocus={editingTo}
                      />
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="combined-invoice-send-subject">Subject</Label>
                  <Input
                    id="combined-invoice-send-subject"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="combined-invoice-email-message">Message</Label>
                  <Textarea
                    id="combined-invoice-email-message"
                    value={emailMessage}
                    onChange={(event) => setEmailMessage(event.target.value)}
                    rows={4}
                    className="resize-y text-sm"
                  />
                </div>

                <div className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-info/10">
                    <FileText className="size-4 text-info" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">Delivery packages</p>
                    <p className="text-xs text-muted-foreground">
                      {unbilledDeliverables.length} file
                      {unbilledDeliverables.length === 1 ? "" : "s"} across{" "}
                      {sortedTickets.length} tickets
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="combined-invoice-send-sms" className="cursor-pointer">
                      Also send text message
                    </Label>
                    <Switch
                      id="combined-invoice-send-sms"
                      checked={sendSms}
                      onCheckedChange={setSendSms}
                      disabled={!phone.trim()}
                    />
                  </div>
                  <Input
                    id="combined-invoice-send-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="(203) 555-0100"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    onBlur={() => {
                      const formatted = formatUsPhoneDisplayFromAny(phone);
                      if (formatted !== "—") setPhone(formatted);
                    }}
                  />
                </div>
              </div>

              <div className="min-w-0">
                {paymentEmailHtml ? (
                  <TicketInvoiceSendPreview
                    paymentSubject={subject}
                    paymentEmailHtml={paymentEmailHtml}
                    paymentSmsText={paymentSmsText}
                    deliverySubject={deliverySubject}
                    deliveryEmailHtml=""
                    footerSummary={footerSummary}
                  />
                ) : null}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t px-6 py-4">
          {step === "invoice" ? (
            <>
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={() => setStep("email")}>
                Continue to email
                <ChevronRight className="size-4" />
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => setStep("invoice")}>
                <ChevronLeft className="size-4" />
                Back
              </Button>
              <Button
                type="button"
                disabled={!canSend || sendMutation.isPending}
                onClick={() => sendMutation.mutate()}
              >
                {sendMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Send invoice
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
