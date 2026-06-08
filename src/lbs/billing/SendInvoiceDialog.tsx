import { useMutation } from "@tanstack/react-query";
import { Loader2, Mail, Send, ExternalLink, CheckCircle2, Ban, Trash2 } from "lucide-react";
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
} from "@/lbs/billing/clientInvoicePdf";
import { InvoiceShareLinkDialog } from "@/lbs/billing/InvoiceShareLinkDialog";
import {
  canDeleteClientInvoice,
  canMarkClientInvoiceSent,
  canSendClientInvoice,
  canVoidClientInvoice,
  resolveInvoiceRecipientEmail,
} from "@/lbs/billing/billingUtils";
import type { ClientInvoice, ClientInvoiceLineItem } from "@/lbs/types";
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
import { Textarea } from "@/components/ui/textarea";

const useOrganizationAddress = () => {
  const {
    companyAddressLine1,
    companyAddressLine2,
    companyCity,
    companyState,
    companyPostalCode,
    companyCountry,
    companyWebsite,
  } = useConfigurationContext();

  const organizationAddress = useMemo(() => {
    const parts = [
      companyAddressLine1,
      companyAddressLine2,
      [companyCity, companyState, companyPostalCode].filter(Boolean).join(", "),
      companyCountry,
    ].filter(Boolean);
    return parts.length ? parts.join("\n") : null;
  }, [
    companyAddressLine1,
    companyAddressLine2,
    companyCity,
    companyState,
    companyPostalCode,
    companyCountry,
  ]);

  return { organizationAddress, companyWebsite };
};

const buildInvoicePdfContext = buildClientInvoicePdfContext;

export const SendInvoiceDialog = ({
  open,
  onOpenChange,
  invoice,
  organizationName,
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
  const { organizationAddress, companyWebsite } = useOrganizationAddress();
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");

  const { data: lineItems = [] } = useGetList<ClientInvoiceLineItem>(
    "client_invoice_line_items",
    {
      filter: invoice?.id ? { "invoice_id@eq": invoice.id } : {},
      pagination: { page: 1, perPage: 100 },
      sort: { field: "sort_order", order: "ASC" },
    },
    { enabled: Boolean(invoice?.id) },
  );

  useEffect(() => {
    if (!open || !invoice) return;
    setTo(
      resolveInvoiceRecipientEmail({
        company,
        contact,
        fallbackEmail: invoice.recipient_email,
      }),
    );
    setMessage(
      `Please find attached invoice ${invoice.invoice_number} for ${invoice.description}.\n\nThank you for your business.`,
    );
  }, [open, invoice, company, contact]);

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
      return dataProvider.sendClientInvoice({
        invoiceId: invoice.id,
        to,
        message,
        pdfBase64,
        filename: `${invoice.invoice_number}.pdf`,
      });
    },
    onSuccess: (result) => {
      if (result.email_skipped) {
        notify(
          "Invoice marked as sent. Email is not configured — use Share to send the portal link.",
          { type: "warning" },
        );
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send invoice {invoice.invoice_number}</DialogTitle>
          <DialogDescription>
            Email the PDF invoice to your client.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
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
            <Label htmlFor="invoice-send-message">Message</Label>
            <Textarea
              id="invoice-send-message"
              rows={4}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!to.trim() || sendMutation.isPending}
            onClick={() => sendMutation.mutate()}
          >
            {sendMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Send invoice
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
  const [shareUrl, setShareUrl] = useState("");
  const [downloading, setDownloading] = useState(false);
  const { organizationAddress, companyWebsite } = useOrganizationAddress();

  const showSend = canSendClientInvoice(invoice);
  const showMarkSent = canMarkClientInvoiceSent(invoice);
  const showVoid = canVoidClientInvoice(invoice);
  const showDelete = canDeleteClientInvoice(invoice);

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
      const url =
        result.short_url?.startsWith("http") || result.url?.startsWith("http")
          ? result.short_url || result.url
          : `${window.location.origin}${result.short_url || result.url}`;
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

  return (
    <div className="flex flex-wrap justify-end gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={downloading}
        onClick={() => void handleDownload()}
      >
        {downloading ? <Loader2 className="size-3.5 animate-spin" /> : null}
        PDF
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!showSend || shareMutation.isPending}
        onClick={() => shareMutation.mutate()}
      >
        {shareMutation.isPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <ExternalLink className="size-3.5" />
        )}
        Share
      </Button>
      {showSend ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setSendOpen(true)}
        >
          <Mail className="size-3.5" />
          Send
        </Button>
      ) : null}
      {showMarkSent ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={manageMutation.isPending}
          onClick={() => handleManage("mark_sent")}
        >
          {manageMutation.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="size-3.5" />
          )}
          Mark as sent
        </Button>
      ) : null}
      {showVoid ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={manageMutation.isPending}
          onClick={() => handleManage("void")}
        >
          {manageMutation.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Ban className="size-3.5" />
          )}
          Void
        </Button>
      ) : null}
      {showDelete ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={manageMutation.isPending}
          onClick={() => handleManage("delete")}
        >
          {manageMutation.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Trash2 className="size-3.5" />
          )}
          Delete
        </Button>
      ) : null}
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
    </div>
  );
};
