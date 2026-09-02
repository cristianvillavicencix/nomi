import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  isOrgTransactionalEmailConfigured,
  sendTransactionalEmail,
} from "./transactionalEmail.ts";
import { getOrgInvoiceEmailSendOptions } from "./organizationEmailSenders.ts";
import { resolveSubscriptionBillingEmail } from "./clientSubscriptionStripe.ts";
import type { ClientSubscriptionRow } from "./clientSubscriptionStripe.ts";
import {
  buildSubscriptionAgreementPdfFilename,
  buildSubscriptionReceiptPdfFilename,
  generateSubscriptionAgreementPdfBase64,
  generateSubscriptionSetupReceiptPdfBase64,
} from "./subscriptionAgreementPdf.ts";
import {
  buildDefaultAgreementCompletionHtml,
  buildDefaultAgreementCompletionSubject,
  buildDefaultAgreementCompletionText,
} from "./subscriptionAgreementInviteEmail.ts";
import { logSubscriptionDelivery } from "./subscriptionDeliveryLog.ts";
import { resolvePublicAppBaseUrl } from "./publicAppUrl.ts";
import { INVOICE_ORGANIZATION_NAME } from "./invoiceOrganizationInfo.ts";

export type SubscriptionAgreementDocuments = {
  contractPdfBase64: string;
  contractFilename: string;
  receiptPdfBase64: string;
  receiptFilename: string;
  clientEmail: string | null;
};

const resolveClientLabel = async (
  supabase: SupabaseClient,
  subscription: ClientSubscriptionRow,
) => {
  let companyName = "";
  let contactName = "";
  if (subscription.company_id) {
    const { data } = await supabase
      .from("companies")
      .select("name")
      .eq("id", subscription.company_id)
      .maybeSingle();
    companyName = data?.name?.trim() || "";
  }
  if (subscription.contact_id) {
    const { data } = await supabase
      .from("contacts")
      .select("first_name, last_name")
      .eq("id", subscription.contact_id)
      .maybeSingle();
    contactName = [data?.first_name, data?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
  }
  return (
    companyName ||
    contactName ||
    subscription.agreement_signatory_name?.trim() ||
    "Client"
  );
};

const resolveOrgName = async (supabase: SupabaseClient, orgId: number) => {
  const { data } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", orgId)
    .maybeSingle();
  return data?.name?.trim() || INVOICE_ORGANIZATION_NAME;
};

export async function buildSubscriptionAgreementDocuments(
  supabase: SupabaseClient,
  subscription: ClientSubscriptionRow,
): Promise<SubscriptionAgreementDocuments> {
  const clientName = await resolveClientLabel(supabase, subscription);
  const orgName = await resolveOrgName(supabase, subscription.org_id);
  const clientEmail = await resolveSubscriptionBillingEmail(supabase, {
    orgId: subscription.org_id,
    contactId: subscription.contact_id,
    companyId: subscription.company_id,
  });

  const markdown = String(subscription.agreement_terms_markdown ?? "").trim();
  const contractPdfBase64 = await generateSubscriptionAgreementPdfBase64({
    title: subscription.name || "Subscription agreement",
    markdown,
    subscriptionNumber: subscription.subscription_number,
    clientName,
    signaturePngDataUrl: subscription.agreement_signature_png,
  });
  const receiptPdfBase64 = await generateSubscriptionSetupReceiptPdfBase64({
    organizationName: orgName,
    subscriptionName: subscription.name,
    subscriptionNumber: subscription.subscription_number,
    clientName,
    clientEmail,
    amount: Number(subscription.amount) || 0,
    currency: subscription.currency,
    billingInterval: subscription.billing_interval || "monthly",
    paymentMethodLast4: subscription.payment_method_last4,
    completedAt:
      subscription.activated_at ||
      subscription.agreement_signed_at ||
      new Date().toISOString(),
  });

  return {
    contractPdfBase64,
    contractFilename: buildSubscriptionAgreementPdfFilename(
      subscription.subscription_number,
    ),
    receiptPdfBase64,
    receiptFilename: buildSubscriptionReceiptPdfFilename(
      subscription.subscription_number,
    ),
    clientEmail,
  };
}

/**
 * Email signed contract + setup receipt after the client adds a card.
 * Idempotent via agreement_completion_emailed_at.
 */
export async function sendSubscriptionAgreementCompletionEmail(
  supabase: SupabaseClient,
  subscription: ClientSubscriptionRow,
): Promise<{ emailed: boolean; skipped?: string }> {
  if ((subscription as { agreement_completion_emailed_at?: string | null })
    .agreement_completion_emailed_at) {
    return { emailed: false, skipped: "already_sent" };
  }
  if (!subscription.agreement_signed_at) {
    return { emailed: false, skipped: "not_signed" };
  }
  if (!(await isOrgTransactionalEmailConfigured(subscription.org_id))) {
    return { emailed: false, skipped: "email_not_configured" };
  }

  const docs = await buildSubscriptionAgreementDocuments(supabase, subscription);
  if (!docs.clientEmail) {
    return { emailed: false, skipped: "no_email" };
  }

  const orgName = await resolveOrgName(supabase, subscription.org_id);
  const invoiceEmail = await getOrgInvoiceEmailSendOptions(
    subscription.org_id,
    orgName,
  );
  const subject = buildDefaultAgreementCompletionSubject({
    orgName,
    subscriptionName: subscription.name,
    subscriptionNumber: subscription.subscription_number,
  });
  const textBody = buildDefaultAgreementCompletionText({
    orgName,
    subscriptionName: subscription.name,
    contractFilename: docs.contractFilename,
    receiptFilename: docs.receiptFilename,
  });
  const htmlBody = buildDefaultAgreementCompletionHtml({
    orgName,
    subscriptionName: subscription.name,
    contractFilename: docs.contractFilename,
    receiptFilename: docs.receiptFilename,
    logoUrl: `${resolvePublicAppBaseUrl()}/logos/sigma.png`,
  });

  await sendTransactionalEmail({
    orgId: subscription.org_id,
    orgName,
    to: [docs.clientEmail],
    subject,
    textBody,
    htmlBody,
    attachments: [
      {
        name: docs.contractFilename,
        contentBase64: docs.contractPdfBase64,
        contentType: "application/pdf",
      },
      {
        name: docs.receiptFilename,
        contentBase64: docs.receiptPdfBase64,
        contentType: "application/pdf",
      },
    ],
    ...invoiceEmail,
    emailChannel: "billing",
  });

  await logSubscriptionDelivery(supabase, {
    orgId: subscription.org_id,
    subscriptionId: subscription.id,
    channel: "email",
    purpose: "agreement_completion",
    toAddress: docs.clientEmail,
    subject,
    bodyPreview: textBody,
    status: "sent",
    createdBy: subscription.created_by_member_id
      ? Number(subscription.created_by_member_id)
      : null,
  });

  await supabase
    .from("client_subscriptions")
    .update({
      agreement_completion_emailed_at: new Date().toISOString(),
    })
    .eq("id", subscription.id)
    .eq("org_id", subscription.org_id);

  return { emailed: true };
}
