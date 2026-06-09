import { useMutation } from "@tanstack/react-query";
import {
  Copy,
  CreditCard,
  Loader2,
  Mail,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useDataProvider, useNotify } from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { Contact, Company } from "@/components/atomic-crm/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isClientBillingSkipped } from "@/lbs/billing/clientBillingProvider";
import {
  computeInvoiceBalanceDue,
  formatInvoicePaymentMethod,
  hasInvoiceCardOnFile,
} from "@/lbs/billing/invoicePaymentUtils";
import { resolveInvoiceRecipientEmail } from "@/lbs/billing/billingUtils";
import { withInvoicePaymentQuery } from "@/lbs/billing/invoiceEmailTemplate";
import { PayInvoiceDialog } from "@/lbs/billing/public/PayInvoiceDialog";
import {
  fetchPublicInvoice,
  type PublicInvoicePayload,
} from "@/lbs/billing/public/publicInvoiceApi";
import { contactHasSmsPhone } from "@/lbs/messages/messageContactUtils";
import { useSendClientSms } from "@/lbs/messages/useClientSms";
import { useMessagingEnabled } from "@/lbs/messages/useMessagingEnabled";
import type { ClientInvoice } from "@/lbs/types";

type ChargeStep = "choose" | "checkout" | "request_link";

type InvoiceStaffChargeDialogProps = {
  invoice: ClientInvoice;
  contact?: Contact | null;
  company?: Company | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

const formatMoney = (amount: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);

export const InvoiceStaffChargeDialog = ({
  invoice,
  contact,
  company,
  open,
  onOpenChange,
  onSuccess,
}: InvoiceStaffChargeDialogProps) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const sendClientSms = useSendClientSms();
  const { smsEnabled } = useMessagingEnabled();

  const [step, setStep] = useState<ChargeStep>("choose");
  const [chargeContext, setChargeContext] = useState<{
    token: string;
    payload: PublicInvoicePayload;
  } | null>(null);
  const [paymentUrl, setPaymentUrl] = useState("");
  const [linkMessage, setLinkMessage] = useState("");

  const balanceDue = useMemo(
    () =>
      computeInvoiceBalanceDue(
        Number(invoice.amount) || 0,
        Number(invoice.amount_paid) || 0,
      ),
    [invoice.amount, invoice.amount_paid],
  );
  const currency = invoice.currency ?? "USD";
  const cardOnFile = formatInvoicePaymentMethod(invoice);
  const hasCard = hasInvoiceCardOnFile(invoice);
  const recipientEmail = resolveInvoiceRecipientEmail({
    company,
    contact,
    fallbackEmail: invoice.recipient_email,
  });
  const canSms =
    smsEnabled && contact != null && contactHasSmsPhone(contact);

  const resetState = () => {
    setStep("choose");
    setChargeContext(null);
    setPaymentUrl("");
    setLinkMessage(
      `Hi, please pay invoice ${invoice.invoice_number} using the secure link below. Your card is entered on a protected payment page — we never ask for card numbers by email or text.`,
    );
  };

  useEffect(() => {
    if (!open) {
      resetState();
      return;
    }
    if (isClientBillingSkipped()) {
      notify("Online payments are disabled in this environment", {
        type: "warning",
      });
      onOpenChange(false);
    }
  }, [open, invoice.invoice_number, notify, onOpenChange]);

  const prepareCheckoutMutation = useMutation({
    mutationFn: async () => {
      const share = await dataProvider.shareClientInvoice({
        invoiceId: invoice.id,
        baseUrl: window.location.origin,
      });
      const payload = await fetchPublicInvoice(share.token);
      const url = withInvoicePaymentQuery(
        share.short_url?.startsWith("http")
          ? share.short_url
          : `${window.location.origin}${share.short_url || share.url}`,
      );
      return { token: share.token, payload, url };
    },
    onSuccess: (data) => {
      setChargeContext({ token: data.token, payload: data.payload });
      setPaymentUrl(data.url);
      setStep("checkout");
    },
    onError: (error: Error) => {
      notify(error.message || "Could not open payment checkout", {
        type: "error",
      });
    },
  });

  const chargeOnFileMutation = useMutation({
    mutationFn: () =>
      dataProvider.chargeClientInvoiceOnFile({ invoiceId: invoice.id }),
    onSuccess: (result) => {
      notify(
        result.paid_in_full
          ? `Charged ${formatMoney(result.charged_amount, currency)} — paid in full`
          : `Charged ${formatMoney(result.charged_amount, currency)} on card on file`,
        { type: "success" },
      );
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      notify(error.message || "Could not charge card on file", {
        type: "error",
      });
    },
  });

  const prepareLinkMutation = useMutation({
    mutationFn: async () => {
      const share = await dataProvider.shareClientInvoice({
        invoiceId: invoice.id,
        baseUrl: window.location.origin,
      });
      const url = withInvoicePaymentQuery(
        share.short_url?.startsWith("http")
          ? share.short_url
          : `${window.location.origin}${share.short_url || share.url}`,
      );
      return url;
    },
    onSuccess: (url) => {
      setPaymentUrl(url);
      setStep("request_link");
    },
    onError: (error: Error) => {
      notify(error.message || "Could not prepare payment link", {
        type: "error",
      });
    },
  });

  const sendEmailLinkMutation = useMutation({
    mutationFn: () =>
      dataProvider.sendClientInvoicePaymentLink({
        invoiceId: invoice.id,
        to: recipientEmail,
        message: linkMessage.trim() || undefined,
      }),
    onSuccess: (result) => {
      notify(`Secure payment link sent to ${result.to}`, { type: "success" });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      notify(error.message || "Could not send payment link", { type: "error" });
    },
  });

  const copyPaymentUrl = async () => {
    if (!paymentUrl) return;
    await navigator.clipboard.writeText(paymentUrl);
    notify("Payment link copied", { type: "info" });
  };

  const sendSmsLink = async () => {
    if (!contact?.id || !paymentUrl) return;
    try {
      await sendClientSms({
        contactId: contact.id,
        body: `${linkMessage.trim()}\n\n${paymentUrl}`.trim(),
      });
      notify("Secure payment link sent via SMS", { type: "success" });
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Could not send SMS",
        { type: "error" },
      );
    }
  };

  const isBusy =
    prepareCheckoutMutation.isPending ||
    chargeOnFileMutation.isPending ||
    prepareLinkMutation.isPending ||
    sendEmailLinkMutation.isPending;

  if (!open) return null;

  if (step === "checkout" && chargeContext) {
    return (
      <PayInvoiceDialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            onOpenChange(false);
          }
        }}
        token={chargeContext.token}
        payload={chargeContext.payload}
        onSuccess={() => {
          onOpenChange(false);
          onSuccess?.();
        }}
      />
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onOpenChange(false);
      }}
    >
      <DialogContent className="sm:max-w-md">
        {step === "choose" ? (
          <>
            <DialogHeader>
              <DialogTitle>Collect payment</DialogTitle>
              <DialogDescription>
                {invoice.invoice_number} ·{" "}
                {formatMoney(balanceDue, currency)} balance due
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 py-2">
              {hasCard ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto w-full justify-start gap-3 px-4 py-3 text-left"
                  disabled={isBusy}
                  onClick={() => chargeOnFileMutation.mutate()}
                >
                  {chargeOnFileMutation.isPending ? (
                    <Loader2 className="size-4 shrink-0 animate-spin" />
                  ) : (
                    <CreditCard className="size-4 shrink-0" />
                  )}
                  <span>
                    <span className="block font-medium">Charge card on file</span>
                    <span className="block text-xs text-muted-foreground">
                      {cardOnFile ?? "Saved card"} · no checkout needed
                    </span>
                  </span>
                </Button>
              ) : null}

              <Button
                type="button"
                variant="outline"
                className="h-auto w-full justify-start gap-3 px-4 py-3 text-left"
                disabled={isBusy}
                onClick={() => prepareCheckoutMutation.mutate()}
              >
                {prepareCheckoutMutation.isPending ? (
                  <Loader2 className="size-4 shrink-0 animate-spin" />
                ) : (
                  <CreditCard className="size-4 shrink-0" />
                )}
                <span>
                  <span className="block font-medium">Enter card now</span>
                  <span className="block text-xs text-muted-foreground">
                    Stripe checkout — use with the client in person or on a call
                  </span>
                </span>
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-auto w-full justify-start gap-3 px-4 py-3 text-left"
                disabled={isBusy}
                onClick={() => prepareLinkMutation.mutate()}
              >
                {prepareLinkMutation.isPending ? (
                  <Loader2 className="size-4 shrink-0 animate-spin" />
                ) : (
                  <ShieldCheck className="size-4 shrink-0" />
                )}
                <span>
                  <span className="block font-medium">Send secure payment link</span>
                  <span className="block text-xs text-muted-foreground">
                    Email or SMS — client enters card on the secure portal
                  </span>
                </span>
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Card numbers are never stored in the CRM. Payments run through Stripe.
            </p>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Send secure payment link</DialogTitle>
              <DialogDescription>
                The client pays on a PCI-compliant page. Do not collect card numbers
                by email, text, or phone.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="payment-link-message">Message</Label>
                <Textarea
                  id="payment-link-message"
                  rows={4}
                  value={linkMessage}
                  onChange={(event) => setLinkMessage(event.target.value)}
                />
              </div>

              {recipientEmail ? (
                <Button
                  type="button"
                  className="w-full justify-start gap-2"
                  variant="outline"
                  disabled={sendEmailLinkMutation.isPending}
                  onClick={() => sendEmailLinkMutation.mutate()}
                >
                  {sendEmailLinkMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Mail className="size-4" />
                  )}
                  Email {recipientEmail}
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No email on file — add a contact email or use SMS / copy link.
                </p>
              )}

              {canSms ? (
                <Button
                  type="button"
                  className="w-full justify-start gap-2"
                  variant="outline"
                  disabled={isBusy}
                  onClick={() => void sendSmsLink()}
                >
                  <MessageSquare className="size-4" />
                  Text client
                </Button>
              ) : null}

              <Button
                type="button"
                className="w-full justify-start gap-2"
                variant="outline"
                disabled={!paymentUrl}
                onClick={() => void copyPaymentUrl()}
              >
                <Copy className="size-4" />
                Copy payment link
              </Button>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep("choose")}
              >
                Back
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
