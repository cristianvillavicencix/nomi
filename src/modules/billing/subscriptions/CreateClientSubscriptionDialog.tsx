import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  useDataProvider,
  useGetIdentity,
  useNotify,
  useRefresh,
} from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import {
  BillToClientSearch,
  type BillToSelection,
} from "@/modules/billing/BillToClientSearch";
import { CatalogLineItemField } from "@/modules/billing/CatalogLineItemField";
import { InvoiceSendDeliveryPreview } from "@/modules/billing/InvoiceSendDeliveryPreview";
import {
  resolveBillingRecipientEmail,
  resolveBillingRecipientPhone,
} from "@/modules/billing/billingRecipientResolution";
import type { InvoiceLineDraft } from "@/modules/billing/invoiceLineUtils";
import { buildDefaultSubscriptionSetupMessage } from "@/modules/billing/subscriptions/subscriptionDisplayUtils";
import { BILLING_INTERVALS } from "@/modules/proposals/proposalCommercialConstants";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type CreateClientSubscriptionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const emptyLine = (): InvoiceLineDraft => ({
  key: crypto.randomUUID(),
  title: "",
  item_detail: "",
  quantity: 1,
  unit: "ea",
  unit_price: 0,
  sort_order: 0,
});

export const CreateClientSubscriptionDialog = ({
  open,
  onOpenChange,
}: CreateClientSubscriptionDialogProps) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const { identity } = useGetIdentity();
  const { title: orgTitle } = useConfigurationContext();
  const dataProvider = useDataProvider<CrmDataProvider>();

  const [billTo, setBillTo] = useState<BillToSelection | null>(null);
  const [line, setLine] = useState<InvoiceLineDraft>(emptyLine);
  const [billingInterval, setBillingInterval] = useState<
    "weekly" | "monthly" | "yearly"
  >("monthly");
  const [sendEmail, setSendEmail] = useState(true);
  const [sendSms, setSendSms] = useState(true);
  const [message, setMessage] = useState("");

  const recipientEmail = useMemo(
    () =>
      resolveBillingRecipientEmail({
        company: billTo?.company,
        contact: billTo?.contact,
      }),
    [billTo],
  );

  const recipientPhone = useMemo(
    () =>
      resolveBillingRecipientPhone({
        company: billTo?.company,
        contact: billTo?.contact,
      }),
    [billTo],
  );

  const subscriptionName = line.title.trim() || "Subscription";
  const amount = Number(line.unit_price) || 0;
  const checkoutPlaceholder = "https://checkout.stripe.com/…";

  const defaultMessage = useMemo(
    () =>
      buildDefaultSubscriptionSetupMessage({
        orgLabel: orgTitle ?? "Latino Business Support",
        subscriptionName,
        checkoutUrl: checkoutPlaceholder,
      }),
    [orgTitle, subscriptionName],
  );

  const deliveryMessage = message.trim() || defaultMessage;

  useEffect(() => {
    if (!open) return;
    setSendEmail(Boolean(recipientEmail));
    setSendSms(Boolean(recipientPhone));
  }, [open, recipientEmail, recipientPhone]);

  const createMutation = useMutation({
    mutationFn: () =>
      dataProvider.createClientSubscription({
        company_id: billTo?.companyId ?? null,
        contact_id: billTo?.contactId ?? null,
        name: subscriptionName,
        amount,
        billing_interval: billingInterval,
        line_items: [
          {
            description: subscriptionName,
            quantity: 1,
            unit: line.unit ?? "ea",
            unit_price: amount,
            package_id: line.package_id ?? null,
            addon_id: line.addon_id ?? null,
          },
        ],
        send_email: sendEmail,
        send_sms: sendSms,
        email_to: recipientEmail || null,
        sms_to: recipientPhone || null,
        message: deliveryMessage,
        base_url: window.location.origin,
      }),
    onSuccess: (result) => {
      refresh();
      onOpenChange(false);
      setBillTo(null);
      setLine(emptyLine());
      setBillingInterval("monthly");
      setMessage("");
      if (result.used_saved_card) {
        notify("Subscription activated with card on file", { type: "success" });
      } else {
        notify("Subscription created — setup link sent to client", {
          type: "success",
        });
      }
    },
    onError: (error: Error) => {
      notify(error.message || "Could not create subscription", { type: "error" });
    },
  });

  const canSubmit =
    Boolean(billTo) && amount > 0 && subscriptionName.length > 0 && identity;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New subscription</DialogTitle>
          <DialogDescription>
            Create a recurring plan with automatic Stripe billing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Client</Label>
            <BillToClientSearch value={billTo} onChange={setBillTo} />
          </div>

          <div className="space-y-2">
            <Label>Service</Label>
            <CatalogLineItemField
              line={line}
              onChange={(patch) => setLine((current) => ({ ...current, ...patch }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subscription-interval">Billing interval</Label>
            <Select
              value={billingInterval}
              onValueChange={(value) =>
                setBillingInterval(value as "weekly" | "monthly" | "yearly")
              }
            >
              <SelectTrigger id="subscription-interval">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BILLING_INTERVALS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subscription-amount">Amount (USD)</Label>
            <Input
              id="subscription-amount"
              type="number"
              min={0}
              step="0.01"
              value={Number.isFinite(amount) ? amount : ""}
              onChange={(event) =>
                setLine((current) => ({
                  ...current,
                  unit_price: Number(event.target.value),
                }))
              }
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={sendEmail}
                onCheckedChange={(checked) => setSendEmail(checked === true)}
                disabled={!recipientEmail}
              />
              Send email{recipientEmail ? ` to ${recipientEmail}` : ""}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={sendSms}
                onCheckedChange={(checked) => setSendSms(checked === true)}
                disabled={!recipientPhone}
              />
              Send SMS{recipientPhone ? ` to ${recipientPhone}` : ""}
            </label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subscription-message">Message</Label>
            <Textarea
              id="subscription-message"
              rows={4}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={defaultMessage}
            />
          </div>

          {(sendEmail || sendSms) && (recipientEmail || recipientPhone) ? (
            <InvoiceSendDeliveryPreview
              subject={`${orgTitle ?? "Latino Business Support"}: Set up ${subscriptionName}`}
              emailHtml={deliveryMessage.replace(/\n/g, "<br/>")}
              smsText={deliveryMessage}
              emailTo={recipientEmail}
              smsTo={recipientPhone}
              sendSms={sendSms}
              sendEmail={sendEmail}
            />
          ) : null}
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
            variant="primary"
            disabled={!canSubmit || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Creating…
              </>
            ) : (
              "Create subscription"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
