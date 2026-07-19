import { useMutation } from "@tanstack/react-query";
import { Copy, Loader2, MessageSquare } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useDataProvider, useGetIdentity, useNotify } from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { Company, Contact } from "@/components/atomic-crm/types";
import {
  formatOrganizationMemberName,
  resolveInvoiceRecipientPhone,
} from "@/modules/billing/billingUtils";
import {
  buildInvoiceSmsText,
  resolveClientInvoiceShareUrl,
} from "@/modules/billing/invoiceEmailTemplate";
import type { ClientInvoice } from "@/modules/types";
import { formatUsPhoneDisplayFromAny } from "@/utils/phone";
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

export const InvoiceShareLinkDialog = ({
  open,
  onOpenChange,
  shareUrl,
  invoice,
  invoiceNumber,
  organizationName,
  company,
  contact,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareUrl: string;
  invoice?: ClientInvoice | null;
  invoiceNumber?: string;
  organizationName?: string;
  contact?: Contact | null;
  company?: Company | null;
}) => {
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { identity } = useGetIdentity();
  const [sendSms, setSendSms] = useState(false);
  const [phone, setPhone] = useState("");

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

  const smsPaymentUrl = useMemo(() => {
    if (!shareUrl) return "";
    return resolveClientInvoiceShareUrl(
      { url: shareUrl, short_url: shareUrl },
      typeof window !== "undefined" ? window.location.origin : "",
    );
  }, [shareUrl]);

  const smsText = useMemo(() => {
    if (!invoice || !smsPaymentUrl || !organizationName) return "";
    return buildInvoiceSmsText({
      invoice,
      organizationName,
      paymentUrl: smsPaymentUrl,
      contact,
      senderFirstName,
    });
  }, [invoice, smsPaymentUrl, organizationName, contact, senderFirstName]);

  useEffect(() => {
    if (!open) return;
    const defaultPhone = resolveInvoiceRecipientPhone({ company, contact });
    setPhone(defaultPhone);
    setSendSms(Boolean(defaultPhone.trim()));
  }, [open, company, contact]);

  const copyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    notify("Link copied", { type: "info" });
  };

  const smsMutation = useMutation({
    mutationFn: async () => {
      if (!invoice?.id) throw new Error("Missing invoice");
      if (!phone.trim()) throw new Error("Enter a mobile number");
      return dataProvider.sendClientInvoice({
        invoiceId: invoice.id,
        to: invoice.recipient_email?.trim() || "client@invoice.local",
        linkOnly: true,
        smsTo: phone.trim(),
        smsBody: smsText || `Your invoice link: ${smsPaymentUrl || shareUrl}`,
        contactId: contact?.id ?? invoice.contact_id ?? undefined,
      });
    },
    onSuccess: (result) => {
      if (result.sms_sent) {
        notify("Link sent by text message", { type: "success" });
      } else if (result.sms_skipped) {
        notify("Text message was not sent — check Communications settings.", {
          type: "warning",
        });
      } else {
        notify("Link sent", { type: "success" });
      }
      onOpenChange(false);
    },
    onError: (error: Error) => {
      notify(error.message || "Could not send text message", { type: "error" });
    },
  });

  const handlePrimary = () => {
    if (sendSms && phone.trim()) {
      smsMutation.mutate();
      return;
    }
    void copyLink();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share invoice</DialogTitle>
          <DialogDescription>
            {invoiceNumber
              ? `Share invoice ${invoiceNumber} with your client using this link.`
              : "Share this invoice with your client using the link below."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invoice-share-url">Client link</Label>
            <div className="flex gap-2">
              <Input id="invoice-share-url" readOnly value={shareUrl} />
              <Button
                type="button"
                variant="secondary"
                onClick={() => void copyLink()}
              >
                <Copy className="size-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Label
                htmlFor="invoice-share-sms"
                className="flex items-center gap-2"
              >
                <MessageSquare className="size-4 text-muted-foreground" />
                Send text message
              </Label>
              <Switch
                id="invoice-share-sms"
                checked={sendSms}
                onCheckedChange={setSendSms}
              />
            </div>
            {sendSms ? (
              <Input
                id="invoice-share-phone"
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
            ) : null}
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={
              smsMutation.isPending || (sendSms ? !phone.trim() : !shareUrl)
            }
            onClick={handlePrimary}
          >
            {smsMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : sendSms ? (
              <MessageSquare className="size-4" />
            ) : (
              <Copy className="size-4" />
            )}
            {sendSms ? "Send link" : "Copy link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
