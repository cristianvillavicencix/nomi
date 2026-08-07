import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  isOrgTransactionalEmailConfigured,
  sendTransactionalEmail,
} from "./transactionalEmail.ts";
import { getOrgInvoiceEmailSendOptions } from "./organizationEmailSenders.ts";
import { sendTicketInvoiceSms } from "./ticketInvoiceFlow.ts";

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
  sendEmail?: boolean;
  sendSms?: boolean;
  contactId?: number | null;
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
  const lines = [
    `${orgLabel}: Set up your ${planLabel} subscription and save your card for automatic billing:`,
  ];
  if (params.subscriptionNumber?.trim()) {
    lines.push(`Reference: ${params.subscriptionNumber.trim()}`);
  }
  lines.push("", params.shareUrl.trim());
  return lines.join("\n");
};

const replaceSetupUrlsInMessage = (message: string, shareUrl: string) => {
  const trimmedShareUrl = shareUrl.trim();
  if (!trimmedShareUrl) return message.trim();

  return message
    .trim()
    .replace(/https:\/\/checkout\.stripe\.com[^\s]*/gi, trimmedShareUrl)
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
  >,
) => {
  const defaultMessage = buildDefaultSubscriptionSetupMessage({
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

  const subject =
    params.message && custom
      ? undefined
      : `${params.orgName?.trim() || "Latino Business Support"}: Set up ${params.subscriptionName}`;

  return { message, defaultSubject: subject ?? `${params.orgName?.trim() || "Latino Business Support"}: Set up ${params.subscriptionName}` };
};

export async function sendSubscriptionSetupDelivery(
  supabase: SupabaseClient,
  params: SubscriptionSetupDeliveryParams,
) {
  const { message, defaultSubject } = resolveSubscriptionSetupDeliveryCopy(params);
  const subject = params.subject?.trim() || defaultSubject;

  let emailSent = false;
  let emailSkipped = false;
  let smsSent = false;
  let smsSkipped = false;

  const emailTo = params.emailTo?.trim();
  if (params.sendEmail !== false && emailTo) {
    if (await isOrgTransactionalEmailConfigured(params.orgId)) {
      const invoiceEmail = await getOrgInvoiceEmailSendOptions(
        params.orgId,
        params.orgName,
      );
      await sendTransactionalEmail({
        orgId: params.orgId,
        orgName: params.orgName,
        to: [emailTo],
        subject,
        textBody: message,
        htmlBody: message.replace(/\n/g, "<br/>"),
        ...invoiceEmail,
        emailChannel: "billing",
      });
      emailSent = true;
    } else {
      emailSkipped = true;
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
      if (smsOutcome.sent) smsSent = true;
      if (smsOutcome.skipped) smsSkipped = true;
    } catch (error) {
      console.warn("sendSubscriptionSetupDelivery.sms_error", error);
      smsSkipped = true;
    }
  } else if (params.sendSms !== false) {
    smsSkipped = true;
  }

  return { emailSent, emailSkipped, smsSent, smsSkipped, message, subject };
}
