import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { hasMemberCapability } from "../_shared/memberModulePermissions.ts";
import { markClientInvoiceSent } from "../_shared/clientInvoiceFlow.ts";
import {
  isOrgTransactionalEmailConfigured,
  sendTransactionalEmail,
} from "../_shared/transactionalEmail.ts";
import { getOrgInvoiceEmailSendOptions } from "../_shared/organizationEmailSenders.ts";
import { getMessagingSettingsSecrets } from "../_shared/messagingSettings.ts";
import { sendTwilioSms } from "../_shared/twilio.ts";
import { normalizeUsPhoneToE164 } from "../_shared/phone.ts";
import {
  ensureClientConversation,
  insertSmsMessage,
  touchConversationFirstResponse,
} from "../_shared/messagingConversations.ts";
import { sanitizeMessageBody } from "../_shared/messagingUtils.ts";

type SendBody = {
  invoice_id?: number;
  to?: string;
  cc?: string[];
  bcc?: string[];
  subject?: string;
  message?: string;
  html_message?: string;
  pdf_base64?: string;
  filename?: string;
  sms_to?: string;
  sms_body?: string;
  contact_id?: number;
  link_only?: boolean;
  sms_only?: boolean;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmailList = (values?: string[] | string) => {
  const list = Array.isArray(values)
    ? values
    : String(values ?? "")
        .split(/[,;]/)
        .map((entry) => entry.trim());
  return list
    .map((entry) => entry.toLowerCase())
    .filter((entry) => entry.length > 0 && emailRegex.test(entry));
};

const parseSmsPhoneList = (value: string): string[] => {
  const seen = new Set<string>();
  const phones: string[] = [];
  for (const part of value.split(/[,;]/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const normalized = normalizeUsPhoneToE164(trimmed);
    if (!normalized) {
      throw new Error(`Enter a valid 10-digit US number: ${trimmed}`);
    }
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    phones.push(normalized);
  }
  return phones;
};

async function sendInvoiceSms(params: {
  orgId: number;
  memberId: number;
  phoneRaw: string;
  body: string;
  contactId?: number | null;
}) {
  const normalizedPhone = normalizeUsPhoneToE164(params.phoneRaw);
  if (!normalizedPhone) {
    throw new Error("Enter a valid US mobile number for text delivery");
  }

  const settings = await getMessagingSettingsSecrets(params.orgId);
  if (!settings?.sms_enabled) {
    return { sent: false, skipped: true, reason: "sms_disabled" as const };
  }

  const accountSid = settings.twilio_account_sid?.trim();
  const authToken = settings.twilio_auth_token?.trim();
  const fromNumber = settings.twilio_phone_number?.trim();
  if (!accountSid || !authToken || !fromNumber) {
    return {
      sent: false,
      skipped: true,
      reason: "sms_not_configured" as const,
    };
  }

  const body = sanitizeMessageBody(params.body.trim());
  if (!body) {
    throw new Error("Text message body is empty");
  }

  const twilioResponse = await sendTwilioSms({
    accountSid,
    authToken,
    from: fromNumber,
    to: normalizedPhone,
    body,
  });

  if (params.contactId) {
    const { data: contact } = await supabaseAdmin
      .from("contacts")
      .select("id, first_name, last_name")
      .eq("id", params.contactId)
      .eq("org_id", params.orgId)
      .maybeSingle();

    if (contact?.id) {
      const conversation = await ensureClientConversation({
        orgId: params.orgId,
        externalPhone: normalizedPhone,
        contactId: contact.id,
        dealId: null,
        createdByMemberId: params.memberId,
        title:
          `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() ||
          normalizedPhone,
      });

      const message = await insertSmsMessage({
        conversationId: Number(conversation.id),
        body,
        direction: "outbound",
        authorMemberId: params.memberId,
        externalId: twilioResponse.sid ?? null,
        mediaUrl: null,
        isInternalNote: false,
        replyToMessageId: null,
      });

      await touchConversationFirstResponse(
        Number(conversation.id),
        message.created_at ?? new Date().toISOString(),
      );
    }
  }

  return { sent: true, skipped: false, reason: null };
}

Deno.serve(
  OptionsMiddleware(async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    return UserMiddleware(req, async (req, user) => {
      if (!user) {
        return createErrorResponse(401, "Unauthorized");
      }

      try {
        const member = await getUserOrganizationMember(user);
        if (!member?.id) {
          return createErrorResponse(401, "Unauthorized");
        }

        if (
          !member.administrator &&
          !hasMemberCapability(member, "proposals.send")
        ) {
          return createErrorResponse(403, "You cannot send invoices");
        }

        const body = (await req.json()) as SendBody;
        const invoiceId = Number(body.invoice_id);
        const linkOnly = body.link_only === true;
        const smsOnly = body.sms_only === true;
        const toList = normalizeEmailList(String(body.to ?? ""));
        const pdfBase64 = String(body.pdf_base64 ?? "").trim();
        const smsToRaw = String(body.sms_to ?? "").trim();
        const smsBody = String(body.sms_body ?? "").trim();
        const contactId =
          body.contact_id != null && Number.isFinite(Number(body.contact_id))
            ? Number(body.contact_id)
            : null;
        const cc = normalizeEmailList(body.cc);
        const bcc = normalizeEmailList(body.bcc);

        if (!Number.isFinite(invoiceId)) {
          return createErrorResponse(400, "Invalid invoice_id");
        }

        if (linkOnly || smsOnly) {
          let smsPhones: string[] = [];
          try {
            smsPhones = parseSmsPhoneList(smsToRaw);
          } catch (error) {
            return createErrorResponse(
              400,
              error instanceof Error ? error.message : "Invalid phone number",
            );
          }
          if (!smsPhones.length || !smsBody) {
            return createErrorResponse(
              400,
              "sms_to and sms_body are required for text delivery",
            );
          }

          const { data: invoice } = await supabaseAdmin
            .from("client_invoices")
            .select("id, org_id, status, contact_id, recipient_email")
            .eq("id", invoiceId)
            .eq("org_id", member.org_id)
            .maybeSingle();

          if (!invoice) {
            return createErrorResponse(404, "Invoice not found");
          }

          if (invoice.status === "void") {
            return createErrorResponse(400, "Void invoices cannot be shared");
          }

          if (smsOnly && (invoice.status === "paid")) {
            return createErrorResponse(
              400,
              "Paid invoices cannot be sent again",
            );
          }

          let smsSent = false;
          let smsSkipped = false;
          for (const smsPhone of smsPhones) {
            const smsOutcome = await sendInvoiceSms({
              orgId: member.org_id,
              memberId: Number(member.id),
              phoneRaw: smsPhone,
              body: smsBody,
              contactId: contactId ?? invoice.contact_id ?? null,
            });
            if (smsOutcome.sent) smsSent = true;
            if (smsOutcome.skipped) smsSkipped = true;
          }

          if (smsOnly) {
            let recipientEmail = String(invoice.recipient_email ?? "").trim();
            if (!recipientEmail && invoice.contact_id) {
              const { data: contact } = await supabaseAdmin
                .from("contacts")
                .select("email_jsonb")
                .eq("id", invoice.contact_id)
                .eq("org_id", member.org_id)
                .maybeSingle();
              const firstEmail = Array.isArray(contact?.email_jsonb)
                ? contact?.email_jsonb.find(
                    (entry) =>
                      typeof entry === "object" &&
                      entry &&
                      "email" in entry &&
                      String((entry as { email?: string }).email ?? "").trim(),
                  )
                : null;
              recipientEmail =
                typeof firstEmail === "object" &&
                firstEmail &&
                "email" in firstEmail
                  ? String((firstEmail as { email?: string }).email ?? "").trim()
                  : recipientEmail;
            }

            const updated = await markClientInvoiceSent(
              supabaseAdmin,
              invoiceId,
              member.org_id,
              recipientEmail || smsPhones[0] || "",
            );

            return new Response(
              JSON.stringify({
                invoice: updated,
                sent: true,
                email_sent: false,
                email_skipped: true,
                sms_sent: smsSent,
                sms_skipped: smsSkipped,
                sms_only: true,
              }),
              {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }

          return new Response(
            JSON.stringify({
              invoice,
              sent: true,
              email_sent: false,
              email_skipped: true,
              sms_sent: smsSent,
              sms_skipped: smsSkipped,
              link_only: true,
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        if (!toList.length) {
          return createErrorResponse(
            400,
            "Enter at least one valid recipient email",
          );
        }

        if (!pdfBase64) {
          return createErrorResponse(400, "pdf_base64 is required");
        }

        let smsPhones: string[] = [];
        if (smsToRaw) {
          try {
            smsPhones = parseSmsPhoneList(smsToRaw);
          } catch (error) {
            return createErrorResponse(
              400,
              error instanceof Error ? error.message : "Invalid phone number",
            );
          }
        }

        if (smsToRaw && !smsBody) {
          return createErrorResponse(
            400,
            "sms_body is required when sms_to is set",
          );
        }

        const { data: invoice } = await supabaseAdmin
          .from("client_invoices")
          .select(
            "id, invoice_number, amount, currency, description, org_id, status, contact_id",
          )
          .eq("id", invoiceId)
          .eq("org_id", member.org_id)
          .maybeSingle();

        if (!invoice) {
          return createErrorResponse(404, "Invoice not found");
        }

        if (invoice.status === "paid" || invoice.status === "void") {
          return createErrorResponse(
            400,
            "Paid or void invoices cannot be sent",
          );
        }

        const { data: org } = await supabaseAdmin
          .from("organizations")
          .select("name, email")
          .eq("id", member.org_id)
          .maybeSingle();

        const subject =
          body.subject?.trim() ||
          `${org?.name ?? "Latino Business Support"}: Invoice ${invoice.invoice_number}`;
        const message =
          body.message?.trim() ||
          `Your invoice ${invoice.invoice_number} is attached. Open the payment link in the email to pay online.`;

        const filename =
          body.filename?.trim() || `${invoice.invoice_number}.pdf`;

        let emailSent = false;
        let emailSkipped = false;
        let smsSent = false;
        let smsSkipped = false;

        if (await isOrgTransactionalEmailConfigured(member.org_id)) {
          const invoiceEmail = await getOrgInvoiceEmailSendOptions(
            member.org_id,
            org?.name ?? null,
          );
          await sendTransactionalEmail({
            orgId: member.org_id,
            orgName: org?.name ?? null,
            to: toList,
            cc: cc.length ? cc : undefined,
            bcc: bcc.length ? bcc : undefined,
            subject,
            textBody: message,
            htmlBody: body.html_message?.trim() || null,
            ...invoiceEmail,
            emailChannel: "billing",
            attachments: [
              {
                name: filename,
                contentBase64: pdfBase64,
                contentType: "application/pdf",
              },
            ],
          });
          emailSent = true;
        } else {
          emailSkipped = true;
          console.warn(
            "send_client_invoice.email_skipped",
            "Transactional email is not configured; marking invoice sent without email",
          );
        }

        if (smsPhones.length > 0) {
          try {
            for (const smsPhone of smsPhones) {
              const smsOutcome = await sendInvoiceSms({
                orgId: member.org_id,
                memberId: Number(member.id),
                phoneRaw: smsPhone,
                body: smsBody,
                contactId: contactId ?? invoice.contact_id ?? null,
              });
              if (smsOutcome.sent) smsSent = true;
              if (smsOutcome.skipped) smsSkipped = true;
              if (smsOutcome.skipped) {
                console.warn(
                  "send_client_invoice.sms_skipped",
                  smsOutcome.reason,
                );
              }
            }
          } catch (smsError) {
            console.warn("send_client_invoice.sms_error", smsError);
            smsSkipped = true;
            if (!emailSent) {
              throw smsError;
            }
          }
        }

        const updated = await markClientInvoiceSent(
          supabaseAdmin,
          invoiceId,
          member.org_id,
          toList.join(", "),
        );

        return new Response(
          JSON.stringify({
            invoice: updated,
            sent: true,
            email_sent: emailSent,
            email_skipped: emailSkipped,
            sms_sent: smsSent,
            sms_skipped: smsSkipped,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      } catch (error) {
        console.error("send_client_invoice.error", error);
        return createErrorResponse(
          500,
          error instanceof Error ? error.message : "Unexpected error",
        );
      }
    });
  }),
);
