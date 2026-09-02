import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  isOrgTransactionalEmailConfigured,
  sendTransactionalEmail,
} from "./transactionalEmail.ts";
import { getOrgInvoiceEmailSendOptions } from "./organizationEmailSenders.ts";
import { sendTicketInvoiceSms } from "./ticketInvoiceFlow.ts";
import {
  buildDefaultAgreementInviteHtml,
  buildDefaultAgreementInviteSms,
  buildDefaultAgreementInviteSubject,
  buildDefaultAgreementInviteText,
} from "./subscriptionAgreementInviteEmail.ts";
import {
  logSubscriptionDelivery,
  type SubscriptionDeliveryPurpose,
} from "./subscriptionDeliveryLog.ts";

export type SubscriptionSetupDeliveryParams = {
  orgId: number;
  memberId: number;
  orgName: string | null;
  subscriptionName: string;
  subscriptionNumber?: string | null;
  amountLabel?: string | null;
  shareUrl: string;
  emailTo?: string | null;
  smsTo?: string | null;
  subject?: string | null;
  message?: string | null;
  /** Rich HTML for email; when omitted, text is converted with <br/>. */
  htmlBody?: string | null;
  sendEmail?: boolean;
  sendSms?: boolean;
  contactId?: number | null;
  clientName?: string | null;
  /** When set, writes client_subscription_delivery_logs rows. */
  subscriptionId?: number | null;
  purpose?: SubscriptionDeliveryPurpose;
};

export const buildDefaultSubscriptionSetupMessage = (params: {
  orgName: string | null;
  subscriptionName: string;
  subscriptionNumber?: string | null;
  amountLabel?: string | null;
  shareUrl: string;
}) => {
  const orgLabel = params.orgName?.trim() || "Latino Business Support";
  const planLabel = params.amountLabel
    ? `${params.subscriptionName} (${params.amountLabel})`
    : params.subscriptionName;
  // Single paragraph — avoid blank line before URL (phones split into two bubbles).
  const ref = params.subscriptionNumber?.trim()
    ? ` Reference: ${params.subscriptionNumber.trim()}.`
    : "";
  return `${orgLabel}: Set up your ${planLabel} subscription and save your card for automatic billing.${ref} ${params.shareUrl.trim()}`;
};

export const replaceSetupUrlsInMessage = (message: string, shareUrl: string) => {
  const trimmedShareUrl = shareUrl.trim();
  if (!trimmedShareUrl) return message.trim();

  return message
    .trim()
    .replace(/https:\/\/checkout\.stripe\.com[^\s]*/gi, trimmedShareUrl)
    .replace(/https?:\/\/[^\s/]+\/sub-agree\/[^\s]*/gi, trimmedShareUrl)
    .replace(/https?:\/\/[^\s/]+\/sub\/[^\s]*/gi, trimmedShareUrl);
};

export const resolveSubscriptionSetupDeliveryCopy = (
  params: Pick<
    SubscriptionSetupDeliveryParams,
    | "orgName"
    | "subscriptionName"
    | "subscriptionNumber"
    | "amountLabel"
    | "shareUrl"
    | "message"
    | "purpose"
    | "clientName"
  >,
) => {
  const isAgreementInvite = params.purpose === "agreement_invite";

  const defaultMessage = isAgreementInvite
    ? buildDefaultAgreementInviteSms({
        orgName: params.orgName,
        clientName: params.clientName,
        subscriptionName: params.subscriptionName,
        subscriptionNumber: params.subscriptionNumber,
        amountLabel: params.amountLabel,
        shareUrl: params.shareUrl,
      })
    : buildDefaultSubscriptionSetupMessage({
        orgName: params.orgName,
        subscriptionName: params.subscriptionName,
        subscriptionNumber: params.subscriptionNumber,
        amountLabel: params.amountLabel,
        shareUrl: params.shareUrl,
      });

  const custom = params.message?.trim();
  const message = custom
    ? replaceSetupUrlsInMessage(custom, params.shareUrl)
    : defaultMessage;

  const defaultSubject = isAgreementInvite
    ? buildDefaultAgreementInviteSubject({
        subscriptionName: params.subscriptionName,
      })
    : `${params.orgName?.trim() || "Latino Business Support"}: Set up ${params.subscriptionName}`;

  return { message, defaultSubject, isAgreementInvite, usedCustomMessage: Boolean(custom) };
};

export async function sendSubscriptionSetupDelivery(
  supabase: SupabaseClient,
  params: SubscriptionSetupDeliveryParams,
) {
  const { message, defaultSubject, isAgreementInvite, usedCustomMessage } =
    resolveSubscriptionSetupDeliveryCopy(params);
  const subject = params.subject?.trim() || defaultSubject;
  const purpose = params.purpose ?? "setup_link";

  let emailSent = false;
  let emailSkipped = false;
  let smsSent = false;
  let smsSkipped = false;

  const emailTextBody =
    isAgreementInvite && !usedCustomMessage
      ? buildDefaultAgreementInviteText({
          orgName: params.orgName,
          clientName: params.clientName,
          subscriptionName: params.subscriptionName,
          subscriptionNumber: params.subscriptionNumber,
          amountLabel: params.amountLabel,
          shareUrl: params.shareUrl,
        })
      : message;

  const emailHtmlBody =
    params.htmlBody?.trim() ||
    (isAgreementInvite && !usedCustomMessage
      ? buildDefaultAgreementInviteHtml({
          orgName: params.orgName,
          clientName: params.clientName,
          subscriptionName: params.subscriptionName,
          subscriptionNumber: params.subscriptionNumber,
          amountLabel: params.amountLabel,
          shareUrl: params.shareUrl,
        })
      : emailTextBody.replace(/\n/g, "<br/>"));

  const emailTo = params.emailTo?.trim();
  if (params.sendEmail !== false && emailTo) {
    if (await isOrgTransactionalEmailConfigured(params.orgId)) {
      try {
        const invoiceEmail = await getOrgInvoiceEmailSendOptions(
          params.orgId,
          params.orgName,
        );
        await sendTransactionalEmail({
          orgId: params.orgId,
          orgName: params.orgName,
          to: [emailTo],
          subject,
          textBody: emailTextBody,
          htmlBody: emailHtmlBody,
          ...invoiceEmail,
          emailChannel: "billing",
        });
        emailSent = true;
        if (params.subscriptionId != null) {
          await logSubscriptionDelivery(supabase, {
            orgId: params.orgId,
            subscriptionId: params.subscriptionId,
            channel: "email",
            purpose,
            toAddress: emailTo,
            subject,
            bodyPreview: emailTextBody,
            status: "sent",
            createdBy: params.memberId,
          });
        }
      } catch (error) {
        console.warn("sendSubscriptionSetupDelivery.email_error", error);
        emailSkipped = true;
        if (params.subscriptionId != null) {
          await logSubscriptionDelivery(supabase, {
            orgId: params.orgId,
            subscriptionId: params.subscriptionId,
            channel: "email",
            purpose,
            toAddress: emailTo,
            subject,
            bodyPreview: emailTextBody,
            status: "failed",
            errorMessage:
              error instanceof Error ? error.message : "email_failed",
            createdBy: params.memberId,
          });
        }
      }
    } else {
      emailSkipped = true;
      if (params.subscriptionId != null) {
        await logSubscriptionDelivery(supabase, {
          orgId: params.orgId,
          subscriptionId: params.subscriptionId,
          channel: "email",
          purpose,
          toAddress: emailTo,
          subject,
          bodyPreview: emailTextBody,
          status: "skipped",
          errorMessage: "email_not_configured",
          createdBy: params.memberId,
        });
      }
    }
  } else if (params.sendEmail !== false) {
    emailSkipped = true;
  }

  const smsTo = params.smsTo?.trim();
  if (params.sendSms !== false && smsTo) {
    try {
      const smsOutcome = await sendTicketInvoiceSms(supabase, {
        orgId: params.orgId,
        memberId: params.memberId,
        phoneRaw: smsTo,
        body: message,
        contactId: params.contactId ?? null,
      });
      if (smsOutcome.sent) {
        smsSent = true;
        if (params.subscriptionId != null) {
          await logSubscriptionDelivery(supabase, {
            orgId: params.orgId,
            subscriptionId: params.subscriptionId,
            channel: "sms",
            purpose,
            toAddress: smsTo,
            bodyPreview: message,
            status: "sent",
            createdBy: params.memberId,
          });
        }
      }
      if (smsOutcome.skipped) {
        smsSkipped = true;
        if (params.subscriptionId != null) {
          await logSubscriptionDelivery(supabase, {
            orgId: params.orgId,
            subscriptionId: params.subscriptionId,
            channel: "sms",
            purpose,
            toAddress: smsTo,
            bodyPreview: message,
            status: "skipped",
            errorMessage: smsOutcome.reason ?? "sms_skipped",
            createdBy: params.memberId,
          });
        }
      }
    } catch (error) {
      console.warn("sendSubscriptionSetupDelivery.sms_error", error);
      smsSkipped = true;
      if (params.subscriptionId != null) {
        await logSubscriptionDelivery(supabase, {
          orgId: params.orgId,
          subscriptionId: params.subscriptionId,
          channel: "sms",
          purpose,
          toAddress: smsTo,
          bodyPreview: message,
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "sms_failed",
          createdBy: params.memberId,
        });
      }
    }
  } else if (params.sendSms !== false) {
    smsSkipped = true;
  }

  if (
    params.subscriptionId != null &&
    purpose === "agreement_invite" &&
    (emailSent || smsSent)
  ) {
    await supabase
      .from("client_subscriptions")
      .update({ agreement_invite_sent_at: new Date().toISOString() })
      .eq("id", params.subscriptionId)
      .eq("org_id", params.orgId);
  }

  return { emailSent, emailSkipped, smsSent, smsSkipped, message, subject };
}
