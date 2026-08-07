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
  checkoutUrl: string;
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
  checkoutUrl: string;
}) =>
  `${
    params.orgName ?? "Latino Business Support"
  }: Set up your ${params.subscriptionName} subscription and save your card for automatic billing:\n\n${params.checkoutUrl}`;

export async function sendSubscriptionSetupDelivery(
  supabase: SupabaseClient,
  params: SubscriptionSetupDeliveryParams,
) {
  const message =
    params.message?.trim() ||
    buildDefaultSubscriptionSetupMessage({
      orgName: params.orgName,
      subscriptionName: params.subscriptionName,
      checkoutUrl: params.checkoutUrl,
    });
  const subject =
    params.subject?.trim() ||
    `${params.orgName ?? "Latino Business Support"}: Set up ${params.subscriptionName}`;

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
