import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Loader2,
  Mail,
  MessageSquare,
  Send,
  ExternalLink,
  CheckCircle2,
  Ban,
  Trash2,
  Receipt,
  MoreHorizontal,
  FileDown,
  CreditCard,
  Eye,
  FileText,
  ChevronDown,
  Clock,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  useDataProvider,
  useGetIdentity,
  useGetList,
  useNotify,
} from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { Company, Contact } from "@/components/atomic-crm/types";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import {
  blobToBase64,
  buildClientInvoicePdfContext,
  downloadClientInvoicePdf,
  generateClientInvoicePdfBlob,
} from "@/modules/billing/clientInvoicePdf";
import { InvoiceShareLinkDialog } from "@/modules/billing/InvoiceShareLinkDialog";
import { InvoiceStaffChargeDialog } from "@/modules/billing/InvoiceStaffChargeDialog";
import { VoidInvoiceReasonDialog } from "@/modules/billing/VoidInvoiceReasonDialog";
import {
  buildDefaultInvoiceEmailSubject,
  buildInvoiceEmailHtml,
  buildInvoiceEmailPlainText,
  buildInvoiceSmsText,
  buildOrganizationEmailTagline,
  formatInvoiceDueDate,
  formatInvoiceMoney,
  resolveClientInvoiceShareUrl,
  resolveInvoiceOrganizationName,
} from "@/modules/billing/invoiceEmailTemplate";
import {
  buildInvoiceSendFooterSummary,
  InvoiceSendDeliveryPreview,
} from "@/modules/billing/InvoiceSendDeliveryPreview";
import { getInvoiceOrganizationBranding } from "@/modules/billing/invoiceOrganizationInfo";
import {
  canDeleteClientInvoice,
  canMarkClientInvoiceSent,
  canSendClientInvoice,
  canVoidClientInvoice,
  resolveInvoiceRecipientEmail,
  resolveInvoiceSendRecipientEmail,
  resolveInvoiceSendRecipientPhone,
  formatOrganizationMemberName,
  parseInvoicePhoneList,
} from "@/modules/billing/billingUtils";
import { InvoiceRecipientChipInput } from "@/modules/billing/InvoiceRecipientChipInput";
import {
  canChargeClientInvoice,
  computeInvoiceBalanceDue,
} from "@/modules/billing/invoicePaymentUtils";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import type { ClientInvoice, ClientInvoiceLineItem } from "@/modules/types";

export type InvoiceDeliveryChannel = "email" | "sms" | "both";

const formatPdfSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  return `${Math.round(bytes / 1024)} KB`;
};

const buildInvoicePdfContext = buildClientInvoicePdfContext;

export const SendInvoiceDialog = ({
  open,
  onOpenChange,
  invoice,
  organizationName: organizationNameProp,
  company,
  contact,
  onSent,
  onScheduleSend,
  onShareLink,
  deliveryChannel = "both",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: ClientInvoice | null;
  organizationName: string;
  company?: Company | null;
  contact?: Contact | null;
  onSent?: () => void;
  onScheduleSend?: () => void;
  onShareLink?: (shareUrl: string) => void;
  deliveryChannel?: InvoiceDeliveryChannel;
}) => {
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
  const { title, companyLegalName } = useConfigurationContext();
  const organizationName = useMemo(
    () =>
      resolveInvoiceOrganizationName({
        title: organizationNameProp ?? title,
        companyLegalName,
      }),
    [organizationNameProp, companyLegalName, title],
  );
  const invoiceBranding = useMemo(() => getInvoiceOrganizationBranding(), []);
  const organizationAddress = invoiceBranding.address;
  const companyWebsite = invoiceBranding.website;
  const organizationTagline = useMemo(
    () => buildOrganizationEmailTagline(),
    [],
  );
  const [toEmails, setToEmails] = useState<string[]>([]);
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [bccEmails, setBccEmails] = useState<string[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [phones, setPhones] = useState<string[]>([]);
  const [channel, setChannel] =
    useState<InvoiceDeliveryChannel>(deliveryChannel);
  const [subject, setSubject] = useState("");
  const [pdfPreviewPending, setPdfPreviewPending] = useState(false);

  const parsedEmails = toEmails;
  const parsedPhones = useMemo(
    () => parseInvoicePhoneList(phones.join(", ")),
    [phones],
  );
  const primaryBillToEmail = parsedEmails[0] ?? "";
  const previewEmailTo = parsedEmails.join(", ");
  const previewPhoneTo = phones.join(", ");

  const { data: lineItems = [] } = useGetList<ClientInvoiceLineItem>(
    "client_invoice_line_items",
    {
      filter: invoice?.id ? { "invoice_id@eq": invoice.id } : {},
      pagination: { page: 1, perPage: 100 },
      sort: { field: "sort_order", order: "ASC" },
    },
    { enabled: Boolean(invoice?.id) },
  );

  const {
    data: shareLink,
    isPending: shareLinkPending,
    error: shareLinkError,
  } = useQuery({
    queryKey: ["invoice-send-share-link", invoice?.id],
    queryFn: () =>
      dataProvider.shareClientInvoice({
        invoiceId: invoice!.id,
        baseUrl: window.location.origin,
      }),
    enabled: open && Boolean(invoice?.id),
    staleTime: 0,
  });

  const paymentUrl = shareLink
    ? resolveClientInvoiceShareUrl(shareLink, window.location.origin)
    : "";

  const smsPaymentUrl = useMemo(() => {
    if (!shareLink) return paymentUrl;
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
    return paymentUrl;
  }, [paymentUrl, shareLink]);

  const emailTemplateContext = useMemo(() => {
    if (!invoice || !paymentUrl) return null;
    return {
      invoice,
      lineItems,
      organizationName,
      paymentUrl,
      contact,
      organizationTagline,
    };
  }, [
    invoice,
    lineItems,
    organizationName,
    paymentUrl,
    contact,
    organizationTagline,
  ]);

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

  const emailHtml = useMemo(
    () =>
      emailTemplateContext ? buildInvoiceEmailHtml(emailTemplateContext) : "",
    [emailTemplateContext],
  );

  const balanceDue = useMemo(() => {
    if (!invoice) return 0;
    return computeInvoiceBalanceDue(
      Number(invoice.amount) || 0,
      Number(invoice.amount_paid) || 0,
    );
  }, [invoice]);

  const invoicePdfContext = useMemo(() => {
    if (!invoice) return null;
    return buildInvoicePdfContext({
      invoice,
      organizationName,
      organizationAddress,
      organizationWebsite: companyWebsite,
      company,
      contact,
      lineItems,
      billToEmail: primaryBillToEmail,
    });
  }, [
    invoice,
    organizationName,
    organizationAddress,
    companyWebsite,
    company,
    contact,
    lineItems,
    primaryBillToEmail,
  ]);

  const { data: pdfMeta } = useQuery({
    queryKey: ["invoice-send-pdf-meta", invoice?.id, toEmails.join(",")],
    queryFn: async () => {
      const blob = await generateClientInvoicePdfBlob(invoicePdfContext!);
      return { sizeLabel: formatPdfSize(blob.size) };
    },
    enabled: open && Boolean(invoicePdfContext),
    staleTime: 60_000,
  });

  const footerSummary = useMemo(() => {
    if (!emailTemplateContext) return "";
    return buildInvoiceSendFooterSummary({
      templateContext: emailTemplateContext,
    });
  }, [emailTemplateContext]);

  const previewInvoicePdf = async () => {
    if (!invoicePdfContext) return;
    setPdfPreviewPending(true);
    try {
      const blob = await generateClientInvoicePdfBlob(invoicePdfContext);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      notify("Could not open PDF preview", { type: "error" });
    } finally {
      setPdfPreviewPending(false);
    }
  };

  useEffect(() => {
    if (!open || !invoice) return;

    const defaultEmail = resolveInvoiceSendRecipientEmail({
      company,
      contact,
      fallbackEmail: invoice.recipient_email,
    });
    setToEmails(defaultEmail ? [defaultEmail.toLowerCase()] : []);

    const formattedPhone = resolveInvoiceSendRecipientPhone({ company, contact });
    setPhones(formattedPhone ? [formattedPhone] : []);
    setCcEmails([]);
    setBccEmails([]);
    setShowCc(false);
    setShowBcc(false);
    setChannel(deliveryChannel);
    setSubject(buildDefaultInvoiceEmailSubject(invoice, organizationName));
  }, [open, invoice, company, contact, organizationName, deliveryChannel]);

  const sendEmail = channel === "email" || channel === "both";
  const sendSms = channel === "sms" || channel === "both";

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!invoice?.id) throw new Error("Missing invoice");
      if (!emailTemplateContext) {
        throw new Error("Payment link is not ready yet");
      }

      if (sendEmail && parsedEmails.length === 0) {
        throw new Error("Enter at least one recipient email");
      }
      if (sendSms && parsedPhones.length === 0) {
        throw new Error("Enter at least one mobile number");
      }

      if (channel === "sms") {
        return dataProvider.sendClientInvoice({
          invoiceId: invoice.id,
          to: "",
          smsTo: previewPhoneTo,
          smsBody: smsText,
          contactId: contact?.id ?? invoice.contact_id ?? undefined,
          smsOnly: true,
        });
      }

      const blob = await generateClientInvoicePdfBlob(
        buildInvoicePdfContext({
          invoice,
          organizationName,
          organizationAddress,
          organizationWebsite: companyWebsite,
          company,
          contact,
          lineItems,
          billToEmail: primaryBillToEmail,
        }),
      );
      const pdfBase64 = await blobToBase64(blob);
      return dataProvider.sendClientInvoice({
        invoiceId: invoice.id,
        to: previewEmailTo,
        subject: subject.trim(),
        message: buildInvoiceEmailPlainText(emailTemplateContext),
        htmlMessage: buildInvoiceEmailHtml(emailTemplateContext),
        pdfBase64,
        filename: `${invoice.invoice_number}.pdf`,
        cc: ccEmails,
        bcc: bccEmails,
        ...(sendSms && parsedPhones.length > 0
          ? {
              smsTo: previewPhoneTo,
              smsBody: smsText,
              contactId: contact?.id ?? invoice.contact_id ?? undefined,
            }
          : {}),
      });
    },
    onSuccess: (result) => {
      if (channel === "sms") {
        if (result.sms_sent) {
          notify("Invoice sent by text message", { type: "success" });
        } else if (result.sms_skipped) {
          notify(
            "Invoice marked as sent. SMS was not sent — check Communications settings.",
            { type: "warning" },
          );
        } else {
          notify("Invoice sent", { type: "success" });
        }
      } else if (result.email_skipped && !result.sms_sent) {
        notify(
          "Invoice marked as sent. Email and SMS are not configured — use Share to send the portal link.",
          { type: "warning" },
        );
      } else if (result.email_skipped && result.sms_sent) {
        notify("Invoice marked as sent. Text message delivered.", {
          type: "success",
        });
      } else if (result.sms_skipped && sendSms && phones.length > 0) {
        notify(
          result.email_sent
            ? "Invoice emailed. SMS was not sent — check Communications settings."
            : "Invoice sent.",
          { type: "warning" },
        );
      } else if (result.email_sent && result.sms_sent) {
        notify("Invoice sent by email and text", { type: "success" });
      } else if (channel === "email" && result.email_sent) {
        notify("Invoice sent by email", { type: "success" });
      } else {
        notify("Invoice sent", { type: "success" });
      }
      onOpenChange(false);
      onSent?.();
    },
    onError: (error: Error) => {
      notify(error.message || "Failed to send invoice", { type: "error" });
    },
  });

  if (!invoice) return null;

  const emailReady = parsedEmails.length > 0 && Boolean(subject.trim());
  const phoneReady = parsedPhones.length > 0;

  const canSend =
    !shareLinkPending &&
    Boolean(paymentUrl) &&
    Boolean(emailTemplateContext) &&
    ((channel === "email" && emailReady) ||
      (channel === "sms" && phoneReady) ||
      (channel === "both" && emailReady && phoneReady));

  const channelOptions: Array<{
    id: InvoiceDeliveryChannel;
    label: string;
    icon: typeof Mail;
  }> = [
    { id: "email", label: "Email only", icon: Mail },
    { id: "sms", label: "SMS only", icon: MessageSquare },
    { id: "both", label: "Email + SMS", icon: Send },
  ];

  const showSendMenu = Boolean(onScheduleSend || onShareLink);

  const handleShareLink = () => {
    if (!paymentUrl) return;
    onOpenChange(false);
    onShareLink?.(paymentUrl);
  };

  const handleScheduleSend = () => {
    onOpenChange(false);
    onScheduleSend?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {channel === "sms"
              ? "Send invoice by SMS"
              : channel === "email"
                ? "Send invoice by email"
                : "Send invoice by email and SMS"}
            <Badge variant="outline" className="font-mono text-xs font-normal">
              {invoice.invoice_number}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Configure delivery on the left · preview on the right.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3">
              <div>
                <p className="text-xs text-muted-foreground">Amount due</p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatInvoiceMoney(balanceDue, invoice.currency)}
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
              <Label>Delivery</Label>
              <div className="flex flex-wrap gap-2">
                {channelOptions.map((option) => {
                  const Icon = option.icon;
                  const selected = channel === option.id;
                  return (
                    <Button
                      key={option.id}
                      type="button"
                      size="sm"
                      variant={selected ? "primary" : "secondary"}
                      className="gap-1.5"
                      onClick={() => setChannel(option.id)}
                    >
                      <Icon className="size-3.5" />
                      {option.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            {sendEmail ? (
              <div className="space-y-2">
                <InvoiceRecipientChipInput
                  id="invoice-send-to"
                  label="To"
                  mode="email"
                  values={toEmails}
                  onChange={setToEmails}
                  placeholder="client@example.com"
                  helperText="Press comma or Enter to add another recipient."
                />
                {!showCc || !showBcc ? (
                  <div className="flex gap-3">
                    {!showCc ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-auto px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                        onClick={() => setShowCc(true)}
                      >
                        + Cc
                      </Button>
                    ) : null}
                    {!showBcc ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-auto px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                        onClick={() => setShowBcc(true)}
                      >
                        + Bcc
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {sendEmail ? (
              <div className="space-y-2">
                <Label htmlFor="invoice-send-subject">Subject</Label>
                <Input
                  id="invoice-send-subject"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                />
              </div>
            ) : null}

            {sendEmail ? (
              <div className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-destructive/10">
                  <FileText className="size-4 text-destructive" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {invoice.invoice_number}.pdf
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {pdfMeta?.sizeLabel ?? "PDF attachment"}
                  </p>
                </div>
                <IconButton
                  className="shrink-0"
                  disabled={pdfPreviewPending || !invoicePdfContext}
                  aria-label="Preview PDF attachment"
                  onClick={() => void previewInvoicePdf()}
                >
                  {pdfPreviewPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </IconButton>
              </div>
            ) : null}

            {sendEmail && showCc ? (
              <InvoiceRecipientChipInput
                id="invoice-send-cc"
                label="Cc"
                mode="email"
                values={ccEmails}
                onChange={setCcEmails}
                placeholder="cc@example.com"
              />
            ) : null}

            {sendEmail && showBcc ? (
              <InvoiceRecipientChipInput
                id="invoice-send-bcc"
                label="Bcc"
                mode="email"
                values={bccEmails}
                onChange={setBccEmails}
                placeholder="bcc@example.com"
              />
            ) : null}

            {sendSms ? (
              <InvoiceRecipientChipInput
                id="invoice-send-phone"
                label="Text message to"
                mode="phone"
                values={phones}
                onChange={setPhones}
                placeholder="(203) 555-0100"
                helperText="US mobile numbers only · 10 digits each · press comma or Enter to add another."
              />
            ) : null}

            {shareLinkPending ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Generating payment link…
              </p>
            ) : null}
            {shareLinkError ? (
              <p className="text-sm text-destructive">
                Could not generate payment link. Try again or use Share.
              </p>
            ) : null}
          </div>

          <div className="min-w-0">
            {emailTemplateContext ? (
              <InvoiceSendDeliveryPreview
                subject={subject}
                emailHtml={emailHtml}
                smsText={smsText}
                emailTo={previewEmailTo}
                smsTo={previewPhoneTo}
                sendSms={sendSms}
                sendEmail={sendEmail}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Payment link is loading…
              </p>
            )}
          </div>
        </div>
        <DialogFooter className="gap-3 sm:items-center sm:justify-between">
          <p className="text-left text-sm text-muted-foreground">
            {footerSummary || "Loading delivery summary…"}
          </p>
          <div className="flex shrink-0 justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            {showSendMenu ? (
              <div className="flex">
                <Button
                  type="button"
                  disabled={!canSend || sendMutation.isPending}
                  className="rounded-r-none"
                  onClick={() => sendMutation.mutate()}
                >
                  {sendMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  Save and Send
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      disabled={sendMutation.isPending}
                      className="rounded-l-none border-l border-primary-foreground/20 px-2"
                      aria-label="More send options"
                    >
                      <ChevronDown className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onScheduleSend ? (
                      <DropdownMenuItem
                        disabled={shareLinkPending || !paymentUrl}
                        onClick={handleScheduleSend}
                      >
                        <Clock className="size-4" />
                        Save &amp; Send Later
                      </DropdownMenuItem>
                    ) : null}
                    {onShareLink ? (
                      <DropdownMenuItem
                        disabled={shareLinkPending || !paymentUrl}
                        onClick={handleShareLink}
                      >
                        <ExternalLink className="size-4" />
                        Save &amp; Share link
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
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
                Save and Send
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const InvoiceRowActions = ({
  invoice,
  organizationName,
  company,
  contact,
  onRefresh,
  onDeleted,
}: {
  invoice: ClientInvoice;
  organizationName: string;
  company?: Company | null;
  contact?: Contact | null;
  onRefresh?: () => void;
  onDeleted?: () => void;
}) => {
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [sendOpen, setSendOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [voidReasonOpen, setVoidReasonOpen] = useState(false);
  const invoiceBranding = useMemo(() => getInvoiceOrganizationBranding(), []);
  const organizationAddress = invoiceBranding.address;
  const companyWebsite = invoiceBranding.website;

  const showSend = canSendClientInvoice(invoice);
  const showMarkSent = canMarkClientInvoiceSent(invoice);
  const showVoid = canVoidClientInvoice(invoice);
  const showDelete = canDeleteClientInvoice(invoice);
  const showResendReceipt =
    Number(invoice.amount_paid ?? 0) > 0 && invoice.status !== "void";
  const showCharge = canChargeClientInvoice(invoice);

  const { data: lineItems = [] } = useGetList<ClientInvoiceLineItem>(
    "client_invoice_line_items",
    {
      filter: { "invoice_id@eq": invoice.id },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "sort_order", order: "ASC" },
    },
  );

  const pdfContext = useMemo(
    () =>
      buildInvoicePdfContext({
        invoice,
        organizationName,
        organizationAddress,
        organizationWebsite: companyWebsite,
        company,
        contact,
        lineItems,
        billToEmail: resolveInvoiceRecipientEmail({ company, contact }),
      }),
    [
      invoice,
      organizationName,
      organizationAddress,
      companyWebsite,
      company,
      contact,
      lineItems,
    ],
  );

  const shareMutation = useMutation({
    mutationFn: () =>
      dataProvider.shareClientInvoice({
        invoiceId: invoice.id,
        baseUrl: window.location.origin,
      }),
    onSuccess: (result) => {
      const url = resolveClientInvoiceShareUrl(result, window.location.origin);
      setShareUrl(url);
      setShareOpen(true);
    },
    onError: (error: Error) => {
      notify(error.message || "Could not generate share link", {
        type: "error",
      });
    },
  });

  const manageMutation = useMutation({
    mutationFn: ({
      action,
      voidReason,
    }: {
      action: "mark_sent" | "void" | "delete";
      voidReason?: string;
    }) =>
      dataProvider.manageClientInvoice({
        invoiceId: invoice.id,
        action,
        voidReason,
      }),
    onSuccess: (_data, { action }) => {
      if (action === "void") {
        setVoidReasonOpen(false);
      }
      if (action === "mark_sent") {
        notify("Invoice marked as sent", { type: "success" });
        onRefresh?.();
        return;
      }
      if (action === "void") {
        notify("Invoice voided", { type: "success" });
        onRefresh?.();
        return;
      }
      notify("Invoice deleted", { type: "success" });
      onDeleted?.();
    },
    onError: (error: Error) => {
      notify(error.message || "Could not update invoice", { type: "error" });
    },
  });

  const resendReceiptMutation = useMutation({
    mutationFn: () =>
      dataProvider.resendClientInvoicePaymentReceipt({
        invoiceId: invoice.id,
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

  const handleManage = (action: "mark_sent" | "void" | "delete") => {
    if (action === "void") {
      setVoidReasonOpen(true);
      return;
    }
    if (action === "delete") {
      const confirmed = window.confirm(
        `Delete invoice ${invoice.invoice_number}? This cannot be undone.`,
      );
      if (!confirmed) return;
    }
    manageMutation.mutate({ action });
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadClientInvoicePdf(pdfContext);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Could not download PDF",
        { type: "error" },
      );
    } finally {
      setDownloading(false);
    }
  };

  const showDestructiveActions = showVoid || showDelete;
  const isBusy =
    downloading ||
    shareMutation.isPending ||
    manageMutation.isPending ||
    resendReceiptMutation.isPending;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton aria-label="Invoice actions" disabled={isBusy}>
            {isBusy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <MoreHorizontal className="size-4" />
            )}
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            disabled={downloading}
            onSelect={() => void handleDownload()}
          >
            {downloading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileDown className="size-4" />
            )}
            Download PDF
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!showSend || shareMutation.isPending}
            onSelect={() => shareMutation.mutate()}
          >
            {shareMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ExternalLink className="size-4" />
            )}
            Share
          </DropdownMenuItem>
          {showSend ? (
            <DropdownMenuItem onSelect={() => setSendOpen(true)}>
              <Mail className="size-4" />
              Send
            </DropdownMenuItem>
          ) : null}
          {showCharge ? (
            <DropdownMenuItem onSelect={() => setChargeOpen(true)}>
              <CreditCard className="size-4" />
              Charge
            </DropdownMenuItem>
          ) : null}
          {showResendReceipt ? (
            <DropdownMenuItem
              disabled={resendReceiptMutation.isPending}
              onSelect={() => resendReceiptMutation.mutate()}
            >
              {resendReceiptMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Receipt className="size-4" />
              )}
              Receipt
            </DropdownMenuItem>
          ) : null}
          {showMarkSent ? (
            <DropdownMenuItem
              disabled={manageMutation.isPending}
              onSelect={() => handleManage("mark_sent")}
            >
              {manageMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Mark as sent
            </DropdownMenuItem>
          ) : null}
          {showDestructiveActions ? <DropdownMenuSeparator /> : null}
          {showVoid ? (
            <DropdownMenuItem
              variant="destructive"
              disabled={manageMutation.isPending}
              onSelect={() => handleManage("void")}
            >
              <Ban className="size-4" />
              Void
            </DropdownMenuItem>
          ) : null}
          {showDelete ? (
            <DropdownMenuItem
              variant="destructive"
              disabled={manageMutation.isPending}
              onSelect={() => handleManage("delete")}
            >
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <SendInvoiceDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        invoice={invoice}
        organizationName={organizationName}
        company={company}
        contact={contact}
        onSent={onRefresh}
      />
      <InvoiceShareLinkDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        shareUrl={shareUrl}
        invoice={invoice}
        invoiceNumber={invoice.invoice_number}
        organizationName={organizationName}
        company={company}
        contact={contact}
      />
      {showCharge ? (
        <InvoiceStaffChargeDialog
          invoice={invoice}
          company={company}
          contact={contact}
          open={chargeOpen}
          onOpenChange={setChargeOpen}
          onSuccess={onRefresh}
        />
      ) : null}
      <VoidInvoiceReasonDialog
        open={voidReasonOpen}
        invoiceNumber={invoice.invoice_number}
        pending={manageMutation.isPending}
        onOpenChange={setVoidReasonOpen}
        onConfirm={(voidReason) =>
          manageMutation.mutate({ action: "void", voidReason })
        }
      />
    </>
  );
};
