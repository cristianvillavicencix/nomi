import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  useDataProvider,
  useGetIdentity,
  useNotify,
} from "ra-core";
import type { Company, Contact } from "@/components/atomic-crm/types";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import { InvoiceSendDeliveryPreview } from "@/modules/billing/InvoiceSendDeliveryPreview";
import {
  formatInvoiceDueDate,
  resolveInvoiceOrganizationName,
} from "@/modules/billing/invoiceEmailTemplate";
import {
  formatOrganizationMemberName,
  resolveInvoiceRecipientPhone,
} from "@/modules/billing/billingUtils";
import type { ClientInvoice, Ticket } from "@/modules/types";
import {
  buildTicketPaymentEmailHtml,
  buildTicketPaymentReminderSmsText,
  buildTicketPaymentReminderSubject,
  DEFAULT_TICKET_PAYMENT_REMINDER_MESSAGE,
  formatTicketInvoicePreviewMoney,
} from "@/modules/tickets/ticketInvoicePreview";
import { resolveTicketRequesterEmail } from "@/modules/tickets/ticketRequester";
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

type TicketInvoiceReminderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: Ticket;
  invoice: ClientInvoice;
  company?: Company | null;
  contact?: Contact | null;
};

export const TicketInvoiceReminderDialog = ({
  open,
  onOpenChange,
  ticket,
  invoice,
  company,
  contact,
}: TicketInvoiceReminderDialogProps) => {
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { identity } = useGetIdentity();
  const { title, companyLegalName } = useConfigurationContext();
  const propertyAddress = ticket.subject?.trim() || "Your property";
  const [recipientEmail, setRecipientEmail] = useState("");
  const [subject, setSubject] = useState(
    buildTicketPaymentReminderSubject(propertyAddress),
  );
  const [emailMessage, setEmailMessage] = useState(
    DEFAULT_TICKET_PAYMENT_REMINDER_MESSAGE,
  );
  const [phone, setPhone] = useState("");
  const [sendSms, setSendSms] = useState(false);

  const organizationName = useMemo(
    () => resolveInvoiceOrganizationName({ title, companyLegalName }),
    [title, companyLegalName],
  );

  const senderFirstName = useMemo(() => {
    const name = formatOrganizationMemberName(
      identity as {
        first_name?: string | null;
        last_name?: string | null;
        fullName?: string | null;
      } | null,
    );
    return name?.split(/\s+/)[0] ?? null;
  }, [identity]);

  const { data: shareLink, isPending: shareLinkPending } = useQuery({
    queryKey: ["ticket-invoice-reminder-share", invoice.id],
    queryFn: () =>
      dataProvider.shareClientInvoice({
        invoiceId: invoice.id,
        baseUrl: window.location.origin,
      }),
    enabled: open && Boolean(invoice.id),
    staleTime: 0,
  });

  const paymentUrl = useMemo(() => {
    if (!shareLink) return "";
    if (shareLink.short_code?.trim()) {
      return `${window.location.origin.replace(/\/$/, "")}/iv/${shareLink.short_code}?pay=1`;
    }
    if (shareLink.short_url?.trim()) return shareLink.short_url;
    if (shareLink.url?.trim()) return shareLink.url;
    return "";
  }, [shareLink]);

  useEffect(() => {
    if (!open) return;
    setRecipientEmail(
      resolveTicketRequesterEmail(ticket, company, contact) ||
        invoice.recipient_email?.trim() ||
        "",
    );
    setSubject(buildTicketPaymentReminderSubject(propertyAddress));
    setEmailMessage(DEFAULT_TICKET_PAYMENT_REMINDER_MESSAGE);
    const defaultPhone = resolveInvoiceRecipientPhone({ company, contact });
    setPhone(defaultPhone);
    setSendSms(Boolean(defaultPhone.trim()));
  }, [open, ticket, company, contact, invoice.recipient_email, propertyAddress]);

  const amountFormatted = formatTicketInvoicePreviewMoney(
    Number(invoice.amount) || 0,
  );

  const emailHtml = paymentUrl
    ? buildTicketPaymentEmailHtml({
        orgName: organizationName,
        invoiceNumber: invoice.invoice_number,
        amountFormatted,
        paymentUrl,
        customMessage: emailMessage,
      })
    : "";

  const smsText = paymentUrl
    ? buildTicketPaymentReminderSmsText({
        orgName: organizationName,
        invoiceNumber: invoice.invoice_number,
        amountFormatted,
        dueDateFormatted: formatInvoiceDueDate(invoice.due_date),
        paymentUrl,
        contact,
        senderFirstName,
      })
    : "";

  const sendMutation = useMutation({
    mutationFn: () =>
      dataProvider.sendClientInvoicePaymentLink({
        invoiceId: invoice.id,
        to: recipientEmail.trim(),
        subject: subject.trim(),
        message: emailMessage,
        smsTo: sendSms ? phone.trim() : undefined,
        smsBody: sendSms ? smsText : undefined,
        sendSms,
      }),
    onSuccess: (result) => {
      if (result.sms_skipped && sendSms) {
        notify("Reminder email sent · text message was not sent (SMS not configured)", {
          type: "warning",
        });
      } else if (result.sms_sent) {
        notify("Payment reminder sent by email and text", { type: "success" });
      } else {
        notify("Payment reminder sent", { type: "success" });
      }
      onOpenChange(false);
    },
    onError: (error: Error) =>
      notify(error.message || "Could not send reminder", { type: "error" }),
  });

  const canSend =
    Boolean(recipientEmail.trim()) &&
    Boolean(subject.trim()) &&
    Boolean(paymentUrl) &&
    (!sendSms || Boolean(phone.trim())) &&
    !shareLinkPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,900px)] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(96vw,72rem)]">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>Send payment reminder</DialogTitle>
          <DialogDescription>
            Review the reminder before sending · {invoice.invoice_number}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
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
                    {formatInvoiceDueDate(invoice.due_date)}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ticket-reminder-to">To</Label>
                <Input
                  id="ticket-reminder-to"
                  type="email"
                  value={recipientEmail}
                  onChange={(event) => setRecipientEmail(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ticket-reminder-subject">Subject</Label>
                <Input
                  id="ticket-reminder-subject"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ticket-reminder-message">Message</Label>
                <Textarea
                  id="ticket-reminder-message"
                  value={emailMessage}
                  onChange={(event) => setEmailMessage(event.target.value)}
                  rows={4}
                  className="resize-y text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Invoice details and the payment button are added automatically
                  below your message.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="ticket-reminder-send-sms" className="cursor-pointer">
                    Also send text message
                  </Label>
                  <Switch
                    id="ticket-reminder-send-sms"
                    checked={sendSms}
                    onCheckedChange={setSendSms}
                    disabled={!phone.trim()}
                  />
                </div>
                <Input
                  id="ticket-reminder-phone"
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
                  className={cn(!sendSms && "opacity-60")}
                />
              </div>
            </div>

            <div className="min-w-0">
              {shareLinkPending ? (
                <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Loading payment link…
                </div>
              ) : emailHtml ? (
                <InvoiceSendDeliveryPreview
                  subject={subject}
                  emailHtml={emailHtml}
                  smsText={smsText}
                  emailTo={recipientEmail}
                  smsTo={phone}
                  sendSms={sendSms}
                />
              ) : (
                <p className="text-sm text-destructive">
                  Could not load payment link for preview.
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t px-6 py-4 sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {amountFormatted} due {formatInvoiceDueDate(invoice.due_date)}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={sendMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => sendMutation.mutate()}
              disabled={!canSend || sendMutation.isPending}
            >
              {sendMutation.isPending ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <Send className="mr-1.5 size-4" />
              )}
              Send reminder
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
