import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Loader2,
  Mail,
  Send,
  ExternalLink,
  CheckCircle2,
  Ban,
  Trash2,
  Receipt,
  MoreHorizontal,
  FileDown,
  CreditCard,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useDataProvider, useGetList, useNotify } from "ra-core";
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
import {
  buildDefaultInvoiceEmailSubject,
  buildInvoiceEmailHtml,
  buildInvoiceEmailPlainText,
  buildInvoiceSmsText,
  buildOrganizationEmailTagline,
  resolveClientInvoiceShareUrl,
  resolveInvoiceOrganizationName,
} from "@/modules/billing/invoiceEmailTemplate";
import { InvoiceSendDeliveryPreview } from "@/modules/billing/InvoiceSendDeliveryPreview";
import { getInvoiceOrganizationBranding } from "@/modules/billing/invoiceOrganizationInfo";
import {
  canDeleteClientInvoice,
  canMarkClientInvoiceSent,
  canSendClientInvoice,
  canVoidClientInvoice,
  resolveInvoiceRecipientEmail,
  resolveInvoiceRecipientPhone,
} from "@/modules/billing/billingUtils";
import { canChargeClientInvoice } from "@/modules/billing/invoicePaymentUtils";
import { formatUsPhoneDisplayFromAny } from "@/utils/phone";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

const buildInvoicePdfContext = buildClientInvoicePdfContext;

export const SendInvoiceDialog = ({
  open,
  onOpenChange,
  invoice,
  organizationName: organizationNameProp,
  company,
  contact,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: ClientInvoice | null;
  organizationName: string;
  company?: Company | null;
  contact?: Contact | null;
  onSent?: () => void;
}) => {
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
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
  const organizationTagline = useMemo(() => buildOrganizationEmailTagline(), []);
  const [to, setTo] = useState("");
  const [phone, setPhone] = useState("");
  const [sendSms, setSendSms] = useState(true);
  const [subject, setSubject] = useState("");

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
      return `${window.location.origin.replace(/\/$/, "")}/iv/${shareLink.short_code}`;
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
    });
  }, [invoice, smsPaymentUrl, organizationName, contact]);

  const emailHtml = useMemo(
    () => (emailTemplateContext ? buildInvoiceEmailHtml(emailTemplateContext) : ""),
    [emailTemplateContext],
  );

  useEffect(() => {
    if (!open || !invoice) return;

    const defaultPhone = resolveInvoiceRecipientPhone({ company, contact });
    setTo(
      resolveInvoiceRecipientEmail({
        company,
        contact,
        fallbackEmail: invoice.recipient_email,
      }),
    );
    setPhone(defaultPhone);
    setSendSms(Boolean(defaultPhone.trim()));
    setSubject(buildDefaultInvoiceEmailSubject(invoice, organizationName));
  }, [open, invoice, company, contact, organizationName]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!invoice?.id) throw new Error("Missing invoice");
      const blob = await generateClientInvoicePdfBlob(
        buildInvoicePdfContext({
          invoice,
          organizationName,
          organizationAddress,
          organizationWebsite: companyWebsite,
          company,
          contact,
          lineItems,
          billToEmail: to,
        }),
      );
      const pdfBase64 = await blobToBase64(blob);
      if (!emailTemplateContext) {
        throw new Error("Payment link is not ready yet");
      }
      return dataProvider.sendClientInvoice({
        invoiceId: invoice.id,
        to,
        subject: subject.trim(),
        message: buildInvoiceEmailPlainText(emailTemplateContext),
        htmlMessage: buildInvoiceEmailHtml(emailTemplateContext),
        pdfBase64,
        filename: `${invoice.invoice_number}.pdf`,
        ...(sendSms && phone.trim()
          ? {
              smsTo: phone.trim(),
              smsBody: smsText,
              contactId: contact?.id ?? invoice.contact_id ?? undefined,
            }
          : {}),
      });
    },
    onSuccess: (result) => {
      if (result.email_skipped && !result.sms_sent) {
        notify(
          "Invoice marked as sent. Email and SMS are not configured — use Share to send the portal link.",
          { type: "warning" },
        );
      } else if (result.email_skipped && result.sms_sent) {
        notify("Invoice marked as sent. Text message delivered.", {
          type: "success",
        });
      } else if (result.sms_skipped && sendSms && phone.trim()) {
        notify(
          result.email_sent
            ? "Invoice emailed. SMS was not sent — check Communications settings."
            : "Invoice sent.",
          { type: "warning" },
        );
      } else if (result.email_sent && result.sms_sent) {
        notify("Invoice sent by email and text", { type: "success" });
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

  const canSend =
    Boolean(to.trim()) &&
    Boolean(subject.trim()) &&
    !shareLinkPending &&
    Boolean(paymentUrl) &&
    Boolean(emailTemplateContext) &&
    (!sendSms || Boolean(phone.trim()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Send invoice {invoice.invoice_number}</DialogTitle>
          <DialogDescription>
            Email with PDF attachment and optional text message. Preview both
            before sending.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="invoice-send-to">Recipient email</Label>
              <Input
                id="invoice-send-to"
                type="email"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice-send-phone">Recipient mobile</Label>
              <Input
                id="invoice-send-phone"
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
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox
                  checked={sendSms}
                  onCheckedChange={(checked) => setSendSms(checked === true)}
                  disabled={!phone.trim()}
                />
                Also send text message
              </label>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="invoice-send-subject">Email subject</Label>
            <Input
              id="invoice-send-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            />
          </div>
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
          {emailTemplateContext ? (
            <InvoiceSendDeliveryPreview
              subject={subject}
              emailHtml={emailHtml}
              smsText={smsText}
              emailTo={to}
              smsTo={phone}
              sendSms={sendSms}
              templateContext={emailTemplateContext}
            />
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
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
            {sendSms && phone.trim() ? " + text" : ""}
          </Button>
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
      notify(error.message || "Could not generate share link", { type: "error" });
    },
  });

  const manageMutation = useMutation({
    mutationFn: (action: "mark_sent" | "void" | "delete") =>
      dataProvider.manageClientInvoice({ invoiceId: invoice.id, action }),
    onSuccess: (_data, action) => {
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
      const confirmed = window.confirm(
        `Void invoice ${invoice.invoice_number}? This cannot be undone.`,
      );
      if (!confirmed) return;
    }
    if (action === "delete") {
      const confirmed = window.confirm(
        `Delete invoice ${invoice.invoice_number}? This cannot be undone.`,
      );
      if (!confirmed) return;
    }
    manageMutation.mutate(action);
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
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Invoice actions"
            disabled={isBusy}
          >
            {isBusy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <MoreHorizontal className="size-4" />
            )}
          </Button>
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
        invoiceNumber={invoice.invoice_number}
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
    </>
  );
};
