import { useMutation } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  useDataProvider,
  useGetMany,
  useNotify,
  useRefresh,
} from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { Company, Contact } from "@/components/atomic-crm/types";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import {
  resolveBillingRecipientEmail,
  resolveBillingRecipientPhone,
} from "@/modules/billing/billingRecipientResolution";
import { InvoiceSendDeliveryPreview } from "@/modules/billing/InvoiceSendDeliveryPreview";
import {
  resolvePublicAppBaseUrl,
  resolveSubscriptionSetupShareUrl,
} from "@/lib/publicAppUrl";
import {
  buildDefaultAgreementInviteEmailHtml,
  buildDefaultAgreementInviteMessage,
  buildDefaultAgreementInviteSubject,
  buildDefaultSubscriptionSetupEmailHtml,
  buildDefaultSubscriptionSetupMessage,
  buildDefaultSubscriptionSetupSubject,
  formatSubscriptionAmountLabel,
  wrapSubscriptionMessageInBrandedHtml,
} from "@/modules/billing/subscriptions/subscriptionDisplayUtils";
import { resolveInvoiceOrganizationName } from "@/modules/billing/invoiceOrganizationInfo";
import { PRODUCT_MARK_SRC } from "@/lib/branding";
import type { ClientSubscription } from "@/modules/types";
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
import { Textarea } from "@/components/ui/textarea";

type SendSubscriptionSetupDialogProps = {
  subscription: ClientSubscription;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** First-time setup vs update card on an already-billing subscription. */
  mode?: "setup" | "card_update";
};

export const SendSubscriptionSetupDialog = ({
  subscription,
  open,
  onOpenChange,
  mode = "setup",
}: SendSubscriptionSetupDialogProps) => {
  const isCardUpdate = mode === "card_update";
  const isAgreement =
    !isCardUpdate &&
    subscription.enrollment_mode === "agreement" &&
    !subscription.agreement_signed_at;
  const notify = useNotify();
  const refresh = useRefresh();
  const { title: orgTitle } = useConfigurationContext();
  const dataProvider = useDataProvider<CrmDataProvider>();

  const { data: companies = [] } = useGetMany<Company>(
    "companies",
    { ids: subscription.company_id ? [subscription.company_id] : [] },
    { enabled: open && Boolean(subscription.company_id) },
  );
  const { data: contacts = [] } = useGetMany<Contact>(
    "contacts",
    { ids: subscription.contact_id ? [subscription.contact_id] : [] },
    { enabled: open && Boolean(subscription.contact_id) },
  );

  const company = companies[0];
  const contact = contacts[0];

  const defaultEmail = useMemo(
    () =>
      resolveBillingRecipientEmail({
        company,
        contact,
      }),
    [company, contact],
  );
  const defaultPhone = useMemo(
    () =>
      resolveBillingRecipientPhone({
        company,
        contact,
      }),
    [company, contact],
  );

  const [emailTo, setEmailTo] = useState(defaultEmail);
  const [smsTo, setSmsTo] = useState(defaultPhone);
  const [sendEmail, setSendEmail] = useState(Boolean(defaultEmail));
  const [sendSms, setSendSms] = useState(Boolean(defaultPhone));
  const [message, setMessage] = useState("");
  const [messageEdited, setMessageEdited] = useState(false);

  const previewShareUrl = useMemo(
    () =>
      resolveSubscriptionSetupShareUrl({
        setup_share_url: subscription.setup_share_url,
        setup_short_code: subscription.setup_short_code,
        enrollment_mode: subscription.enrollment_mode,
      }),
    [
      subscription.setup_share_url,
      subscription.setup_short_code,
      subscription.enrollment_mode,
    ],
  );

  const amountLabel = formatSubscriptionAmountLabel(
    Number(subscription.amount),
    subscription.currency ?? "USD",
    subscription.billing_interval,
  );

  const orgLabel = resolveInvoiceOrganizationName({ title: orgTitle });
  const logoUrl = `${resolvePublicAppBaseUrl()}${PRODUCT_MARK_SRC}`;
  const clientName = useMemo(() => {
    if (contact) {
      return [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim();
    }
    return company?.name?.trim() || "";
  }, [contact, company]);

  const defaultMessage = useMemo(() => {
    const shared = {
      orgLabel,
      subscriptionName: subscription.name,
      subscriptionNumber: subscription.subscription_number,
      amountLabel,
      shareUrl: previewShareUrl,
    };
    if (isAgreement) return buildDefaultAgreementInviteMessage(shared);
    return buildDefaultSubscriptionSetupMessage({
      ...shared,
      kind: isCardUpdate ? "card_update" : "setup",
    });
  }, [
    isCardUpdate,
    orgLabel,
    subscription.name,
    subscription.subscription_number,
    amountLabel,
    previewShareUrl,
    isCardUpdate,
  ]);

  const deliveryMessage = messageEdited ? message.trim() : defaultMessage;
  const setupKind = isCardUpdate ? "card_update" : "setup";
  const subject = isAgreement
    ? buildDefaultAgreementInviteSubject(subscription.name)
    : buildDefaultSubscriptionSetupSubject({
        orgLabel,
        subscriptionName: subscription.name,
        kind: setupKind,
      });

  const emailHtml = messageEdited
    ? wrapSubscriptionMessageInBrandedHtml({
        orgLabel,
        clientName: clientName || null,
        message: deliveryMessage,
        shareUrl: previewShareUrl,
        ctaLabel: isAgreement
          ? "Review & sign agreement"
          : isCardUpdate
            ? "Update card"
            : "Start subscription",
        logoUrl,
      })
    : isAgreement
      ? buildDefaultAgreementInviteEmailHtml({
          orgLabel,
          clientName: clientName || null,
          subscriptionName: subscription.name,
          subscriptionNumber: subscription.subscription_number,
          amountLabel,
          shareUrl: previewShareUrl,
          logoUrl,
        })
      : buildDefaultSubscriptionSetupEmailHtml({
          orgLabel,
          clientName: clientName || null,
          subscriptionName: subscription.name,
          subscriptionNumber: subscription.subscription_number,
          amountLabel,
          shareUrl: previewShareUrl,
          kind: setupKind,
          logoUrl,
        });

  useEffect(() => {
    if (!open) return;
    setEmailTo(defaultEmail);
    setSmsTo(defaultPhone);
    setSendEmail(Boolean(defaultEmail));
    setSendSms(Boolean(defaultPhone));
    setMessage("");
    setMessageEdited(false);
  }, [open, defaultEmail, defaultPhone]);

  const sendMutation = useMutation({
    mutationFn: () =>
      dataProvider.manageClientSubscription({
        subscriptionId: subscription.id,
        action: isCardUpdate
          ? "request_card_update"
          : isAgreement
            ? "send_agreement"
            : "send_setup",
        email_to: emailTo.trim() || null,
        sms_to: smsTo.trim() || null,
        send_email: sendEmail,
        send_sms: sendSms,
        message: messageEdited ? message.trim() || null : null,
        subject,
        base_url: resolvePublicAppBaseUrl(),
      }),
    onSuccess: () => {
      refresh();
      onOpenChange(false);
      notify(
        isCardUpdate
          ? "Card update link sent"
          : isAgreement
            ? "Agreement link sent"
            : "Setup link sent",
        { type: "success" },
      );
    },
    onError: (error: Error) => {
      notify(
        error.message ||
          (isCardUpdate
            ? "Could not send card update link"
            : isAgreement
              ? "Could not send agreement link"
              : "Could not send setup link"),
        { type: "error" },
      );
    },
  });

  const canSubmit =
    (sendEmail && Boolean(emailTo.trim())) ||
    (sendSms && Boolean(smsTo.trim()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isCardUpdate
              ? "Request new card"
              : isAgreement
                ? "Resend agreement link"
                : "Send setup link"}
          </DialogTitle>
          <DialogDescription>
            {isCardUpdate
              ? `Email or text a secure link so the client can add or replace the card used for ${subscription.name}.`
              : isAgreement
                ? `Email or text the agreement link so the client can review, sign, and add a card for ${subscription.name}.`
                : `Email or text a secure short link so the client can save a card for ${subscription.name}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="setup-email">Email</Label>
            <Input
              id="setup-email"
              type="email"
              value={emailTo}
              onChange={(event) => setEmailTo(event.target.value)}
              placeholder="billing@client.com"
            />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={sendEmail}
                onCheckedChange={(checked) => setSendEmail(checked === true)}
                disabled={!emailTo.trim()}
              />
              Send email
            </label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="setup-sms">SMS</Label>
            <Input
              id="setup-sms"
              value={smsTo}
              onChange={(event) => setSmsTo(event.target.value)}
              placeholder="+1 555 555 5555"
            />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={sendSms}
                onCheckedChange={(checked) => setSendSms(checked === true)}
                disabled={!smsTo.trim()}
              />
              Send SMS
            </label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="setup-message">Message</Label>
            <Textarea
              id="setup-message"
              rows={4}
              value={messageEdited ? message : ""}
              onChange={(event) => {
                setMessageEdited(true);
                setMessage(event.target.value);
              }}
              placeholder={defaultMessage}
            />
          </div>

          {(sendEmail || sendSms) && canSubmit ? (
            <InvoiceSendDeliveryPreview
              subject={subject}
              emailHtml={emailHtml}
              smsText={deliveryMessage}
              emailTo={emailTo}
              smsTo={smsTo}
              sendSms={sendSms}
              sendEmail={sendEmail}
              defaultCollapsed
            />
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={!canSubmit || sendMutation.isPending}
            onClick={() => sendMutation.mutate()}
          >
            {sendMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Send className="size-4" />
                {isAgreement ? "Send agreement link" : "Send setup link"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
