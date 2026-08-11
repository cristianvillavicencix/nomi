import { useMutation } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Send,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDataProvider, useGetList, useNotify, useRefresh } from "ra-core";
import type { Company, Contact } from "@/components/atomic-crm/types";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import { InvoiceDocumentPreview } from "@/modules/billing/InvoiceDocumentPreview";
import {
  formatInvoiceDueDate,
  resolveInvoiceOrganizationName,
} from "@/modules/billing/invoiceEmailTemplate";
import {
  resolveInvoiceSendRecipientEmail,
  resolveInvoiceSendRecipientPhone,
} from "@/modules/billing/billingUtils";
import { InvoiceRecipientChipInput } from "@/modules/billing/InvoiceRecipientChipInput";
import { getInvoiceOrganizationBranding } from "@/modules/billing/invoiceOrganizationInfo";
import type {
  ClientInvoice,
  ClientInvoiceLineItem,
  Ticket,
  TicketDeliverable,
} from "@/modules/types";
import {
  buildTicketSendFooterSummary,
  TicketInvoiceSendPreview,
} from "@/modules/tickets/TicketInvoiceSendPreview";
import {
  buildTicketInvoiceSendEmailPreviews,
  clientInvoiceLineItemsToDrafts,
  DEFAULT_TICKET_PAYMENT_EMAIL_MESSAGE,
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
import { cn } from "@/lib/utils";

type PreviewStep = "invoice" | "email";

type TicketInvoicePreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: Ticket;
  company?: Company | null;
  contact?: Contact | null;
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
      Invoice
    </span>
    <ChevronRight className="size-4 text-muted-foreground" />
    <span
      className={cn(
        "font-medium",
        step === "email" ? "text-foreground" : "text-muted-foreground",
      )}
    >
      Email
    </span>
  </div>
);

export const TicketInvoicePreviewDialog = ({
  open,
  onOpenChange,
  ticket,
  company,
  contact,
  onInvoiceSent,
}: TicketInvoicePreviewDialogProps) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { title, companyLegalName } = useConfigurationContext();
  const [step, setStep] = useState<PreviewStep>("invoice");
  const [draftInvoice, setDraftInvoice] = useState<ClientInvoice | null>(null);
  const [lineItems, setLineItems] = useState<ClientInvoiceLineItem[]>([]);
  const [paymentUrl, setPaymentUrl] = useState("");
  const [toEmails, setToEmails] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState(
    DEFAULT_TICKET_PAYMENT_EMAIL_MESSAGE,
  );
  const [deliverySubject, setDeliverySubject] = useState("");
  const [serviceLines, setServiceLines] = useState<string[]>([]);
  const [phones, setPhones] = useState<string[]>([]);
  const [sendSms, setSendSms] = useState(false);
  const sentRef = useRef(false);

  const recipientEmail = toEmails.join(", ");
  const phone = phones.join(", ");

  const { data: deliverables = [] } = useGetList<TicketDeliverable>(
    "ticket_deliverables",
    {
      filter: { "ticket_id@eq": ticket.id },
      sort: { field: "sort_order", order: "ASC" },
      pagination: { page: 1, perPage: 20 },
    },
    { enabled: open && Boolean(ticket.id) },
  );

  const organizationName = useMemo(
    () => resolveInvoiceOrganizationName({ title, companyLegalName }),
    [title, companyLegalName],
  );
  const invoiceBranding = useMemo(() => getInvoiceOrganizationBranding(), []);

  const propertyAddress = ticket.subject?.trim() || "Your property";

  const unbilledDeliverables = useMemo(
    () => deliverables.filter((file) => !file.invoiced_invoice_id),
    [deliverables],
  );

  const applyPaymentCopy = (items: TicketDeliverable[]) => {
    const copy = buildTicketPaymentCopyFromDeliverables(items, propertyAddress);
    setSubject(copy.subject);
    setEmailMessage(copy.message);
    setDeliverySubject(copy.deliverySubject);
    setServiceLines(copy.serviceLines);
  };

  const prepareMutation = useMutation({
    mutationFn: () =>
      dataProvider.prepareTicketInvoice({
        ticketId: ticket.id,
        baseUrl: window.location.origin,
      }),
    onSuccess: (data) => {
      setDraftInvoice(data.invoice as ClientInvoice);
      setLineItems((data.line_items ?? []) as ClientInvoiceLineItem[]);
      setPaymentUrl(data.payment_url);
      const preparedInvoice = data.invoice as ClientInvoice;
      const liveEmail = resolveInvoiceSendRecipientEmail({
        company,
        contact,
        ticketRequesterEmail:
          data.to || resolveTicketRequesterEmail(ticket, company, contact),
        fallbackEmail: preparedInvoice.recipient_email,
      });
      setToEmails(liveEmail ? [liveEmail.toLowerCase()] : []);
      applyPaymentCopy(unbilledDeliverables);
      refresh();
    },
    onError: (error: Error) => {
      notify(error.message || "Could not prepare invoice", { type: "error" });
      onOpenChange(false);
    },
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      dataProvider.sendTicketInvoice({
        ticketId: ticket.id,
        baseUrl: window.location.origin,
        message: emailMessage,
        subject: subject.trim(),
        recipientEmail,
        smsTo: sendSms ? phone : undefined,
        sendSms,
      }),
    onSuccess: () => {
      sentRef.current = true;
      notify("Invoice sent — files will deliver after payment", {
        type: "success",
      });
      onInvoiceSent?.();
      onOpenChange(false);
      refresh();
    },
    onError: (error: Error) =>
      notify(error.message || "Could not send invoice", { type: "error" }),
  });

  const cancelMutation = useMutation({
    mutationFn: () =>
      dataProvider.cancelTicketInvoiceDraft({ ticketId: ticket.id }),
  });

  useEffect(() => {
    if (!open) return;
    sentRef.current = false;
    setStep("invoice");
    setEmailMessage(DEFAULT_TICKET_PAYMENT_EMAIL_MESSAGE);
    setSubject("");
    setDeliverySubject("");
    setServiceLines([]);
    const formattedPhone = resolveInvoiceSendRecipientPhone({ company, contact });
    setPhones(formattedPhone ? [formattedPhone] : []);
    setSendSms(Boolean(formattedPhone.trim()));
    setToEmails([]);
    setDraftInvoice(null);
    setLineItems([]);
    prepareMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- prepare when dialog opens
  }, [open, ticket.id]);

  const previewLines = useMemo(
    () => clientInvoiceLineItemsToDrafts(lineItems),
    [lineItems],
  );

  const sendPreviews = useMemo(
    () =>
      buildTicketInvoiceSendEmailPreviews({
        draftInvoice,
        paymentUrl,
        organizationName,
        emailMessage,
        serviceLines,
        propertyAddress,
        deliverables,
        contactFirstName: contact?.first_name,
      }),
    [
      contact?.first_name,
      deliverables,
      draftInvoice,
      emailMessage,
      organizationName,
      paymentUrl,
      propertyAddress,
      serviceLines,
    ],
  );

  const {
    paymentEmailHtml,
    paymentSmsText,
    deliveryEmailHtml,
    amountFormatted,
    fileCount,
  } = sendPreviews;

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
    toEmails.length > 0 &&
    Boolean(subject.trim()) &&
    Boolean(paymentUrl) &&
    (!sendSms || phones.length > 0);

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
            {step === "invoice" ? "Review invoice" : "Send invoice"}
            {draftInvoice ? (
              <Badge
                variant="outline"
                className="font-mono text-xs font-normal"
              >
                {draftInvoice.invoice_number}
              </Badge>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            {step === "invoice"
              ? "Confirm bill-to, line items, and total before sending."
              : "Configure delivery on the left · preview on the right."}
          </DialogDescription>
          <StepIndicator step={step} />
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />
              Preparing draft invoice…
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

                <InvoiceRecipientChipInput
                  id="ticket-invoice-send-to"
                  label="To"
                  mode="email"
                  values={toEmails}
                  onChange={setToEmails}
                  placeholder="client@example.com"
                  helperText="Press comma or Enter to add another recipient."
                />

                <div className="space-y-2">
                  <Label htmlFor="ticket-invoice-send-subject">Subject</Label>
                  <Input
                    id="ticket-invoice-send-subject"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ticket-invoice-email-message">Message</Label>
                  <Textarea
                    id="ticket-invoice-email-message"
                    value={emailMessage}
                    onChange={(event) => setEmailMessage(event.target.value)}
                    rows={4}
                    className="resize-y text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Invoice details and the payment button are added
                    automatically below your message.
                  </p>
                </div>

                <div className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-info/10">
                    <FileText className="size-4 text-info" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">Delivery package</p>
                    <p className="text-xs text-muted-foreground">
                      {deliverables.length} file
                      {deliverables.length === 1 ? "" : "s"} sent after payment
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label
                      htmlFor="ticket-invoice-send-sms"
                      className="cursor-pointer"
                    >
                      Also send text message
                    </Label>
                    <Switch
                      id="ticket-invoice-send-sms"
                      checked={sendSms}
                      onCheckedChange={setSendSms}
                      disabled={phones.length === 0}
                    />
                  </div>
                  {sendSms ? (
                    <InvoiceRecipientChipInput
                      id="ticket-invoice-send-phone"
                      label="Text message to"
                      mode="phone"
                      values={phones}
                      onChange={setPhones}
                      placeholder="(203) 555-0100"
                      helperText="US mobile numbers only · 10 digits each · press comma or Enter to add another."
                    />
                  ) : null}
                </div>
              </div>

              <div className="min-w-0">
                {paymentEmailHtml ? (
                  <TicketInvoiceSendPreview
                    paymentSubject={subject}
                    paymentEmailHtml={paymentEmailHtml}
                    paymentSmsText={paymentSmsText}
                    deliverySubject={deliverySubject}
                    deliveryEmailHtml={deliveryEmailHtml}
                    emailTo={recipientEmail}
                    smsTo={phone}
                    sendSms={sendSms}
                    fileCount={fileCount}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Payment link is loading…
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t px-6 py-4 sm:justify-between">
          <div>
            {step === "email" && footerSummary ? (
              <p className="text-left text-sm text-muted-foreground">
                {footerSummary}
              </p>
            ) : step === "email" ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setStep("invoice")}
                disabled={sendMutation.isPending || isLoading}
              >
                <ChevronLeft className="mr-1 size-4" />
                Back to invoice
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleClose(false)}
                disabled={sendMutation.isPending || prepareMutation.isPending}
              >
                Cancel
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {step === "invoice" ? (
              <Button
                type="button"
                disabled={isLoading}
                onClick={() => setStep("email")}
              >
                Continue to email
                <ChevronRight className="ml-1 size-4" />
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setStep("invoice")}
                  disabled={sendMutation.isPending}
                >
                  <ChevronLeft className="mr-1 size-4" />
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={() => sendMutation.mutate()}
                  disabled={sendMutation.isPending || !canSend || isLoading}
                >
                  {sendMutation.isPending ? (
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
                  ) : (
                    <Send className="mr-1.5 size-4" />
                  )}
                  Save and Send
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
