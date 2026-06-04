import { useMutation } from "@tanstack/react-query";
import { Loader2, Mail, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { useDataProvider, useNotify } from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { Company, Contact } from "@/components/atomic-crm/types";
import {
  blobToBase64,
  generateClientInvoicePdfBlob,
} from "@/lbs/billing/clientInvoicePdf";
import { resolveInvoiceRecipientEmail } from "@/lbs/billing/billingUtils";
import type { ClientInvoice } from "@/lbs/types";
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
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");

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
      const blob = await generateClientInvoicePdfBlob({
        invoice,
        organizationName,
        companyName: company?.name,
        contactName: contact
          ? [contact.first_name, contact.last_name].filter(Boolean).join(" ")
          : null,
        billToEmail: to,
      });
      const pdfBase64 = await blobToBase64(blob);
      return dataProvider.sendClientInvoice({
        invoiceId: invoice.id,
        to,
        message,
        pdfBase64,
        filename: `${invoice.invoice_number}.pdf`,
      });
    },
    onSuccess: () => {
      notify("Invoice sent", { type: "success" });
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
            Email the PDF invoice to your client via Postmark.
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
}: {
  invoice: ClientInvoice;
  organizationName: string;
  company?: Company | null;
  contact?: Contact | null;
  onRefresh?: () => void;
}) => {
  const [sendOpen, setSendOpen] = useState(false);

  const handleDownload = async () => {
    const blob = await generateClientInvoicePdfBlob({
      invoice,
      organizationName,
      companyName: company?.name,
      contactName: contact
        ? [contact.first_name, contact.last_name].filter(Boolean).join(" ")
        : null,
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${invoice.invoice_number}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex justify-end gap-1">
      <Button type="button" size="sm" variant="outline" onClick={() => void handleDownload()}>
        PDF
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={invoice.status === "void"}
        onClick={() => setSendOpen(true)}
      >
        <Mail className="size-3.5" />
        Send
      </Button>
      <SendInvoiceDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        invoice={invoice}
        organizationName={organizationName}
        company={company}
        contact={contact}
        onSent={onRefresh}
      />
    </div>
  );
};
