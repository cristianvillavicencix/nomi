import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Pencil } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  useDataProvider,
  useGetIdentity,
  useGetList,
  useNotify,
} from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { Company, Contact } from "@/components/atomic-crm/types";
import { getInvoiceOrganizationBranding } from "@/modules/billing/invoiceOrganizationInfo";
import {
  blobToBase64,
  buildClientInvoicePdfContext,
  generateClientInvoicePdfBlob,
} from "@/modules/billing/clientInvoicePdf";
import {
  formatOrganizationMemberName,
  resolveInvoiceRecipientEmail,
  resolveInvoiceRecipientPhone,
} from "@/modules/billing/billingUtils";
import {
  buildInvoiceSmsText,
  resolveClientInvoiceShareUrl,
} from "@/modules/billing/invoiceEmailTemplate";
import {
  combineDateAndSendTime,
  DEFAULT_INVOICE_SEND_TIME,
  formatScheduleDateLabel,
  formatSendTimeDisplay,
  type InvoiceSendSchedulePreset,
  scheduleDateForPreset,
} from "@/modules/billing/invoiceScheduleUtils";
import type { ClientInvoice, ClientInvoiceLineItem } from "@/modules/types";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { getClientShowPath } from "@/app/routing";
import { formatUsPhoneDisplayFromAny } from "@/utils/phone";

const getContactEmail = (contact: Contact) =>
  contact.email_jsonb?.find((row) => row.isPrimary)?.email?.trim() ??
  contact.email_jsonb?.find((row) => row.email?.trim())?.email?.trim() ??
  "";

const getContactLabel = (contact: Contact) =>
  [contact.first_name, contact.last_name].filter(Boolean).join("") ||
  getContactEmail(contact) ||
  "Contact";

type ScheduleInvoiceSendDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: ClientInvoice | null;
  organizationName: string;
  company?: Company | null;
  contact?: Contact | null;
  lineItems?: ClientInvoiceLineItem[];
  onScheduled?: () => void;
};

export const ScheduleInvoiceSendDialog = ({
  open,
  onOpenChange,
  invoice,
  organizationName,
  company,
  contact,
  lineItems = [],
  onScheduled,
}: ScheduleInvoiceSendDialogProps) => {
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { identity } = useGetIdentity();
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
  const invoiceBranding = useMemo(() => getInvoiceOrganizationBranding(), []);
  const organizationAddress = invoiceBranding.address;
  const companyWebsite = invoiceBranding.website;

  const companyId = company?.id ?? contact?.company_id ?? null;

  const { data: companyContacts = [] } = useGetList<Contact>(
    "contacts",
    {
      filter: companyId ? { "company_id@eq": companyId } : {},
      pagination: { page: 1, perPage: 50 },
      sort: { field: "last_name", order: "ASC" },
    },
    { enabled: Boolean(open && companyId) },
  );

  const contactOptions = useMemo(() => {
    const rows = [...companyContacts];
    if (
      contact?.id &&
      !rows.some((row) => String(row.id) === String(contact.id))
    ) {
      rows.unshift(contact);
    }
    return rows
      .map((row) => ({
        id: row.id,
        label: getContactLabel(row),
        email: getContactEmail(row),
      }))
      .filter((row) => row.email);
  }, [companyContacts, contact]);

  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [manualEmail, setManualEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sendSms, setSendSms] = useState(false);
  const [preset, setPreset] = useState<InvoiceSendSchedulePreset>("tomorrow");
  const [customDate, setCustomDate] = useState("");
  const [sendTime, setSendTime] = useState(DEFAULT_INVOICE_SEND_TIME);
  const [editingTime, setEditingTime] = useState(false);

  const tomorrowDate = useMemo(() => scheduleDateForPreset("tomorrow"), []);

  const { data: shareLink } = useQuery({
    queryKey: ["invoice-schedule-share-link", invoice?.id],
    queryFn: () =>
      dataProvider.shareClientInvoice({
        invoiceId: invoice!.id,
        baseUrl: window.location.origin,
      }),
    enabled: open && Boolean(invoice?.id),
    staleTime: 0,
  });

  const smsPaymentUrl = useMemo(() => {
    if (!shareLink) return "";
    if (shareLink.short_url?.trim()) {
      return resolveClientInvoiceShareUrl(
        { url: shareLink.short_url, short_url: shareLink.short_url },
        window.location.origin,
      );
    }
    if (shareLink.short_code?.trim()) {
      return resolveClientInvoiceShareUrl(
        {
          url: `${window.location.origin.replace(/\/$/, "")}/iv/${shareLink.short_code}`,
        },
        window.location.origin,
      );
    }
    return resolveClientInvoiceShareUrl(shareLink, window.location.origin);
  }, [shareLink]);

  const smsText = useMemo(() => {
    if (!invoice || !smsPaymentUrl) return "";
    return buildInvoiceSmsText({
      invoice,
      organizationName,
      paymentUrl: smsPaymentUrl,
      contact,
      senderFirstName,
    });
  }, [invoice, smsPaymentUrl, organizationName, contact, senderFirstName]);

  useEffect(() => {
    if (!open || !invoice) return;

    const defaultEmail = resolveInvoiceRecipientEmail({
      company,
      contact,
      fallbackEmail: invoice.recipient_email,
    });

    const matched = contactOptions.find((row) => row.email === defaultEmail);
    setSelectedContactId(matched ? String(matched.id) : "");
    setManualEmail(matched ? matched.email : defaultEmail);
    const defaultPhone = resolveInvoiceRecipientPhone({ company, contact });
    setPhone(defaultPhone);
    setSendSms(Boolean(defaultPhone.trim()));
    setPreset("tomorrow");
    setCustomDate(formatScheduleDateLabel(tomorrowDate));
    setSendTime(DEFAULT_INVOICE_SEND_TIME);
    setEditingTime(false);
  }, [open, invoice, company, contact, contactOptions, tomorrowDate]);

  const recipientEmail =
    contactOptions.find((row) => String(row.id) === selectedContactId)?.email ??
    manualEmail.trim();

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      if (!invoice?.id) throw new Error("Missing invoice");
      if (!recipientEmail) {
        throw new Error("Select or enter a recipient email");
      }

      const scheduleDate = scheduleDateForPreset(
        preset,
        preset === "custom" ? customDate : undefined,
      );
      const scheduledSendAt = combineDateAndSendTime(scheduleDate, sendTime);

      if (scheduledSendAt.getTime() <= Date.now()) {
        throw new Error("Choose a future date and time");
      }

      const message = `Please find attached invoice ${invoice.invoice_number} for ${invoice.description}.\n\nThank you for your business.`;

      const blob = await generateClientInvoicePdfBlob(
        buildClientInvoicePdfContext({
          invoice,
          organizationName,
          organizationAddress,
          organizationWebsite: companyWebsite,
          company,
          contact,
          lineItems,
          billToEmail: recipientEmail,
        }),
      );

      const pdfBase64 = await blobToBase64(blob);

      return dataProvider.scheduleClientInvoice({
        invoiceId: invoice.id,
        to: recipientEmail,
        message,
        scheduledSendAt: scheduledSendAt.toISOString(),
        pdfBase64,
        filename: `${invoice.invoice_number}.pdf`,
        ...(sendSms && phone.trim()
          ? { smsTo: phone.trim(), smsBody: smsText }
          : {}),
      });
    },
    onSuccess: () => {
      notify("Invoice send scheduled", { type: "success" });
      onOpenChange(false);
      onScheduled?.();
    },
    onError: (error: Error) => {
      notify(error.message || "Could not schedule send", { type: "error" });
    },
  });

  if (!invoice) return null;

  const presetOptions: Array<{
    id: InvoiceSendSchedulePreset;
    label: string;
  }> = [
    {
      id: "tomorrow",
      label: `Tomorrow (${formatScheduleDateLabel(tomorrowDate)})`,
    },
    {
      id: "end_of_week",
      label: "End of this week",
    },
    {
      id: "end_of_month",
      label: "End of this month",
    },
    { id: "custom", label: "Custom" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule send</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Email</Label>
            {contactOptions.length ? (
              <div className="space-y-2">
                {contactOptions.map((row) => (
                  <label
                    key={String(row.id)}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2",
                      selectedContactId === String(row.id) &&
                        "border-primary bg-muted/30",
                    )}
                  >
                    <input
                      type="radio"
                      name="invoice-recipient"
                      className="mt-1"
                      checked={selectedContactId === String(row.id)}
                      onChange={() => {
                        setSelectedContactId(String(row.id));
                        setManualEmail(row.email);
                      }}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">
                        {row.label}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {row.email}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>
                  No contact persons found.{" "}
                  {companyId ? (
                    <Link
                      to={getClientShowPath(companyId)}
                      className="font-medium text-primary hover:underline"
                    >
                      + Add New
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">
                      Select a client first.
                    </span>
                  )}
                </span>
              </div>
            )}

            {!contactOptions.length || !selectedContactId ? (
              <Input
                id="invoice-schedule-email"
                type="email"
                value={manualEmail}
                onChange={(event) => setManualEmail(event.target.value)}
                placeholder="client@example.com"
              />
            ) : null}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="invoice-schedule-sms">
                Also send text message
              </Label>
              <Switch
                id="invoice-schedule-sms"
                checked={sendSms}
                onCheckedChange={setSendSms}
                disabled={!phone.trim()}
              />
            </div>
            <Input
              id="invoice-schedule-phone"
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

          <div className="space-y-3">
            <p className="text-sm font-medium">
              When would you like to send the email?
            </p>
            <div className="space-y-2">
              {presetOptions.map((option) => (
                <label
                  key={option.id}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <input
                    type="radio"
                    name="invoice-send-preset"
                    checked={preset === option.id}
                    onChange={() => setPreset(option.id)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
            {preset === "custom" ? (
              <Input
                type="date"
                value={customDate}
                onChange={(event) => setCustomDate(event.target.value)}
              />
            ) : null}
          </div>

          <div className="text-sm text-muted-foreground">
            {editingTime ? (
              <div className="flex items-center gap-2">
                <span>Note: Emails will be sent at</span>
                <Input
                  type="time"
                  value={sendTime}
                  onChange={(event) => setSendTime(event.target.value)}
                  className="h-8 w-[7.5rem]"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => setEditingTime(false)}
                >
                  Done
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span>
                  Note: Emails will be sent at {formatSendTimeDisplay(sendTime)}
                  .
                </span>
                <IconButton
                  className="size-6 min-h-6 min-w-6 text-muted-foreground hover:text-foreground"
                  aria-label="Edit send time"
                  onClick={() => setEditingTime(true)}
                >
                  <Pencil className="size-3.5" />
                </IconButton>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!recipientEmail || scheduleMutation.isPending}
            onClick={() => scheduleMutation.mutate()}
          >
            {scheduleMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
