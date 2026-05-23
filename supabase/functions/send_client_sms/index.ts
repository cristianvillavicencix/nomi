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
import {
  expandTemplateVariables,
  sanitizeMessageBody,
} from "../_shared/messagingUtils.ts";
import { sendTwilioSms } from "../_shared/twilio.ts";
import { resolveTwilioMediaUrls } from "../_shared/twilioMedia.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { normalizeUsPhoneToE164 } from "../_shared/phone.ts";

type SendBody = {
  conversation_id?: number;
  contact_id?: number;
  deal_id?: number | null;
  body?: string;
  media_urls?: string[];
  is_internal_note?: boolean;
  template_id?: number;
  reply_to_message_id?: number | null;
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
          contactId: number;
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
          externalPhone = phoneRow.external_phone;

          if (phoneRow.contact_id) {
            const { data: contact } = await supabaseAdmin
              .from("contacts")
              .select("first_name, last_name")
              .eq("id", phoneRow.contact_id)
              .maybeSingle();
            contactRecord = contact;
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
          if (!Number.isFinite(contactId)) {
            throw new Error("conversation_id or contact_id is required");
          }

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

        if (body.includes("{{")) {
          body = expandTemplateVariables(body, {
            client_name: contactRecord
              ? `${contactRecord.first_name ?? ""} ${contactRecord.last_name ?? ""}`.trim()
              : null,
            project_name: dealName,
          });
        }

        let externalId: string | null = null;

        if (!isInternalNote) {
          if (!externalPhone) {
            throw new Error("Client phone number is missing");
          }

          const settings = await getMessagingSettingsSecrets(orgId);
          if (!settings?.sms_enabled) {
            throw new Error("SMS is disabled in Settings → Communications");
          }

          const accountSid = settings.twilio_account_sid?.trim();
          const authToken = settings.twilio_auth_token?.trim();
          const fromNumber = settings.twilio_phone_number?.trim();

          if (!accountSid || !authToken || !fromNumber) {
            throw new Error(
              "Twilio is not fully configured in Settings → Communications",
            );
          }

          const twilioMediaUrls = await resolveTwilioMediaUrls(mediaUrls);
          const twilioResponse = await sendTwilioSms({
            accountSid,
            authToken,
            from: fromNumber,
            to: externalPhone,
            body,
            mediaUrls: twilioMediaUrls,
          });
          externalId = twilioResponse.sid ?? null;
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
            mediaUrl: mediaUrls[0] ?? null,
            isInternalNote,
            replyToMessageId,
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
