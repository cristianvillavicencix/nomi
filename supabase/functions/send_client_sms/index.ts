import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { hasMemberCapability } from "../_shared/memberModulePermissions.ts";
import { getMessagingSettingsSecrets } from "../_shared/messagingSettings.ts";
import {
  assertMemberCanAccessConversation,
  deleteConversationIfEmpty,
  ensureClientConversation,
  insertSmsMessage,
  touchConversationFirstResponse,
} from "../_shared/messagingConversations.ts";
import { resendFailedClientSms } from "../_shared/clientSmsResend.ts";
import {
  expandTemplateVariables,
  sanitizeMessageBody,
} from "../_shared/messagingUtils.ts";
import { assertSmsBodyWithinLimit } from "../_shared/smsMessageLimits.ts";
import { sendOrgSms } from "../_shared/sendOrgSms.ts";
import { resolveTwilioMediaUrls } from "../_shared/twilioMedia.ts";
import { normalizeTelnyxDeliveryStatus } from "../_shared/telnyx.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { normalizeUsPhoneToE164, contactHasPhone } from "../_shared/phone.ts";

type SendBody = {
  conversation_id?: number;
  contact_id?: number;
  deal_id?: number | null;
  body?: string;
  media_urls?: string[];
  is_internal_note?: boolean;
  template_id?: number;
  reply_to_message_id?: number | null;
  external_phone?: string;
  resend_message_id?: number;
};

const normalizeTwilioDeliveryStatus = (raw: string | undefined) => {
  const value = raw?.trim().toLowerCase();
  if (!value) return null;
  switch (value) {
    case "queued":
    case "sending":
    case "sent":
    case "delivered":
    case "undelivered":
    case "failed":
    case "canceled":
      return value;
    case "accepted":
      return "queued";
    default:
      return null;
  }
};

Deno.serve((req: Request) =>
  OptionsMiddleware(req, async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    return UserMiddleware(req, async (req, user) => {
      if (!user) {
        return createErrorResponse(401, "Unauthorized");
      }

      const member = await getUserOrganizationMember(user);
      const orgId = member?.org_id != null ? Number(member.org_id) : null;
      const memberId = member?.id != null ? Number(member.id) : null;
      if (!orgId || !memberId) {
        return createErrorResponse(403, "Organization not found");
      }

      try {
        const payload = (await req.json()) as SendBody;
        const isInternalNote = payload.is_internal_note === true;

        if (isInternalNote) {
          if (!hasMemberCapability(member, "messaging.internal_notes.write")) {
            return createErrorResponse(
              403,
              "You don't have permission to write internal notes.",
            );
          }
        } else if (!hasMemberCapability(member, "messaging.send")) {
          return createErrorResponse(
            403,
            "You don't have permission to send messages.",
          );
        }

        const resendMessageId =
          payload.resend_message_id != null &&
          Number.isFinite(Number(payload.resend_message_id))
            ? Number(payload.resend_message_id)
            : null;

        if (resendMessageId) {
          const { message, conversation } = await resendFailedClientSms({
            orgId,
            memberId,
            messageId: resendMessageId,
          });

          return new Response(
            JSON.stringify({ message, conversation }),
            {
              headers: { "Content-Type": "application/json", ...corsHeaders },
            },
          );
        }

        let body = payload.body?.trim() ?? "";
        const mediaUrls = (payload.media_urls ?? [])
          .map((url) => url.trim())
          .filter(Boolean);
        const replyToMessageId =
          payload.reply_to_message_id != null &&
          Number.isFinite(Number(payload.reply_to_message_id))
            ? Number(payload.reply_to_message_id)
            : null;

        if (Number.isFinite(Number(payload.template_id))) {
          const { data: template, error: templateError } = await supabaseAdmin
            .from("message_templates")
            .select("body, org_id")
            .eq("id", Number(payload.template_id))
            .eq("org_id", orgId)
            .maybeSingle();
          if (templateError || !template?.body) {
            throw new Error("Template not found");
          }
          body = template.body;
        }

        if (body) {
          body = sanitizeMessageBody(body);
        }

        if (!body && mediaUrls.length === 0) {
          throw new Error("Message text or an attachment is required");
        }

        let conversationId = Number(payload.conversation_id);
        let externalPhone: string | null = null;
        let contactRecord: {
          first_name?: string | null;
          last_name?: string | null;
        } | null = null;
        let dealName: string | null = null;
        let pendingNewConversation: {
          orgId: number;
          externalPhone: string;
          contactId?: number | null;
          dealId: number | null;
          createdByMemberId: number;
          title: string;
        } | null = null;
        const hasExistingConversation = Number.isFinite(conversationId);

        if (hasExistingConversation) {
          await assertMemberCanAccessConversation(
            memberId,
            orgId,
            conversationId,
          );
          const { data: phoneRow, error: phoneError } = await supabaseAdmin
            .from("conversations")
            .select("external_phone, contact_id, deal_id")
            .eq("id", conversationId)
            .single();

          if (phoneError || !phoneRow?.external_phone) {
            throw new Error(
              "Client phone number is missing on this conversation",
            );
          }

          const requestedPhoneRaw = payload.external_phone?.trim();
          const requestedPhone = requestedPhoneRaw
            ? normalizeUsPhoneToE164(requestedPhoneRaw)
            : null;

          if (phoneRow.contact_id) {
            const { data: contact, error: contactError } = await supabaseAdmin
              .from("contacts")
              .select("id, first_name, last_name, phone_jsonb")
              .eq("id", phoneRow.contact_id)
              .eq("org_id", orgId)
              .maybeSingle();

            if (contactError || !contact) {
              throw new Error("Contact not found");
            }
            contactRecord = contact;

            if (
              requestedPhone &&
              !contactHasPhone(contact.phone_jsonb, requestedPhone)
            ) {
              throw new Error(
                "Selected phone is not registered on this contact",
              );
            }

            externalPhone = requestedPhone ?? phoneRow.external_phone;

            if (requestedPhone && requestedPhone !== phoneRow.external_phone) {
              const { error: updateError } = await supabaseAdmin
                .from("conversations")
                .update({ external_phone: requestedPhone })
                .eq("id", conversationId)
                .eq("org_id", orgId);

              if (updateError) {
                throw new Error(
                  updateError.message ??
                    "Failed to update conversation phone number",
                );
              }
            }
          } else {
            externalPhone = requestedPhone ?? phoneRow.external_phone;
          }

          if (phoneRow.deal_id) {
            const { data: deal } = await supabaseAdmin
              .from("deals")
              .select("name")
              .eq("id", phoneRow.deal_id)
              .maybeSingle();
            dealName = deal?.name ?? null;
          }
        } else {
          const contactId = Number(payload.contact_id);
          const requestedPhoneRaw = payload.external_phone?.trim();
          const requestedPhone = requestedPhoneRaw
            ? normalizeUsPhoneToE164(requestedPhoneRaw)
            : null;

          if (!Number.isFinite(contactId)) {
            if (!requestedPhone) {
              throw new Error(
                "conversation_id, contact_id, or a valid external_phone is required",
              );
            }

            externalPhone = requestedPhone;
            pendingNewConversation = {
              orgId,
              externalPhone: requestedPhone,
              contactId: null,
              dealId:
                payload.deal_id != null &&
                Number.isFinite(Number(payload.deal_id))
                  ? Number(payload.deal_id)
                  : null,
              createdByMemberId: memberId,
              title: requestedPhone,
            };
          } else {
            const { data: contact, error: contactError } = await supabaseAdmin
              .from("contacts")
              .select("id, first_name, last_name, phone_jsonb, company_id")
              .eq("id", contactId)
              .eq("org_id", orgId)
              .maybeSingle();

            if (contactError || !contact) {
              throw new Error("Contact not found");
            }
            contactRecord = contact;

            let normalizedPhone: string | null = null;
            const requestedPhone = payload.external_phone?.trim();
            if (requestedPhone) {
              const normalized = normalizeUsPhoneToE164(requestedPhone);
              if (
                !normalized ||
                !contactHasPhone(contact.phone_jsonb, normalized)
              ) {
                throw new Error(
                  "Selected phone is not registered on this contact",
                );
              }
              normalizedPhone = normalized;
            } else {
              for (const entry of contact.phone_jsonb ?? []) {
                const number =
                  typeof entry === "object" && entry && "number" in entry
                    ? String((entry as { number?: string }).number ?? "")
                    : "";
                const normalized = normalizeUsPhoneToE164(number);
                if (normalized) {
                  normalizedPhone = normalized;
                  break;
                }
              }
            }

            if (!normalizedPhone) {
              throw new Error("This contact has no valid phone number");
            }

            externalPhone = normalizedPhone;
            pendingNewConversation = {
              orgId,
              externalPhone: normalizedPhone,
              contactId: contact.id,
              dealId:
                payload.deal_id != null &&
                Number.isFinite(Number(payload.deal_id))
                  ? Number(payload.deal_id)
                  : null,
              createdByMemberId: memberId,
              title:
                `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() ||
                normalizedPhone,
            };
          }
        }

        if (body.includes("{{")) {
          body = expandTemplateVariables(body, {
            client_name: contactRecord
              ? `${contactRecord.first_name ?? ""} ${contactRecord.last_name ?? ""}`.trim()
              : null,
            project_name: dealName,
          });
        }

        let externalId: string | null = null;
        let initialDeliveryStatus: string | null = null;

        if (!isInternalNote) {
          if (body) {
            assertSmsBodyWithinLimit(body);
          }

          if (!externalPhone) {
            throw new Error("Client phone number is missing");
          }

          const settings = await getMessagingSettingsSecrets(orgId);
          if (!settings?.sms_enabled) {
            throw new Error("SMS is disabled in Settings → Connectors");
          }

          const mediaForSend =
            settings.messaging_provider === "telnyx"
              ? mediaUrls
              : await resolveTwilioMediaUrls(mediaUrls);
          const sendResult = await sendOrgSms({
            orgId,
            to: externalPhone,
            body,
            mediaUrls: mediaForSend,
          });
          externalId = sendResult.sid ?? sendResult.id ?? null;
          initialDeliveryStatus = externalId
            ? sendResult.provider === "telnyx"
              ? (normalizeTelnyxDeliveryStatus(sendResult.status) ?? "queued")
              : (normalizeTwilioDeliveryStatus(sendResult.status) ?? "queued")
            : null;
        }

        if (!hasExistingConversation) {
          if (!pendingNewConversation) {
            throw new Error("conversation_id or contact_id is required");
          }

          const conversation = await ensureClientConversation(
            pendingNewConversation,
          );
          conversationId = Number(conversation.id);
          externalPhone =
            conversation.external_phone ?? pendingNewConversation.externalPhone;
        }

        const messageBody =
          body ||
          (mediaUrls.some((url) => /\.(jpe?g|png|gif|webp)(\?|$)/i.test(url))
            ? "Photo"
            : "Attachment");

        let message;
        try {
          message = await insertSmsMessage({
            conversationId,
            body: messageBody,
            direction: "outbound",
            authorMemberId: memberId,
            externalId,
            mediaUrls,
            isInternalNote,
            replyToMessageId,
            smsDeliveryStatus: initialDeliveryStatus,
          });
        } catch (error) {
          await deleteConversationIfEmpty(conversationId);
          throw error;
        }

        if (!isInternalNote) {
          await touchConversationFirstResponse(
            conversationId,
            message.created_at ?? new Date().toISOString(),
          );
        }

        if (Number.isFinite(Number(payload.template_id))) {
          const templateId = Number(payload.template_id);
          const { data: current } = await supabaseAdmin
            .from("message_templates")
            .select("use_count")
            .eq("id", templateId)
            .maybeSingle();
          await supabaseAdmin
            .from("message_templates")
            .update({ use_count: (current?.use_count ?? 0) + 1 })
            .eq("id", templateId);
        }

        const { data: conversation } = await supabaseAdmin
          .from("conversations")
          .select("*")
          .eq("id", conversationId)
          .single();

        return new Response(
          JSON.stringify({ message, conversation: conversation ?? null }),
          {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to send SMS";
        return createErrorResponse(400, message);
      }
    });
  }),
);
