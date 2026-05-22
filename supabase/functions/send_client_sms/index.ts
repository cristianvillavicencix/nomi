import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { getMessagingSettingsSecrets } from "../_shared/messagingSettings.ts";
import {
  assertMemberCanAccessConversation,
  ensureClientConversation,
  insertSmsMessage,
} from "../_shared/messagingConversations.ts";
import { sendTwilioSms } from "../_shared/twilio.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { normalizeUsPhoneToE164 } from "../_shared/phone.ts";

type SendBody = {
  conversation_id?: number;
  contact_id?: number;
  deal_id?: number | null;
  body?: string;
  media_urls?: string[];
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
        const body = payload.body?.trim() ?? "";
        const mediaUrls = (payload.media_urls ?? [])
          .map((url) => url.trim())
          .filter(Boolean);

        if (!body && mediaUrls.length === 0) {
          throw new Error("Message text or an attachment is required");
        }

        const settings = await getMessagingSettingsSecrets(orgId);
        if (!settings?.sms_enabled) {
          throw new Error("SMS is disabled in Settings → Messaging");
        }

        const accountSid = settings.twilio_account_sid?.trim();
        const authToken = settings.twilio_auth_token?.trim();
        const fromNumber = settings.twilio_phone_number?.trim();

        if (!accountSid || !authToken || !fromNumber) {
          throw new Error("Twilio is not fully configured in Settings → Messaging");
        }

        let conversationId = Number(payload.conversation_id);
        let externalPhone: string | null = null;

        if (Number.isFinite(conversationId)) {
          const conversation = await assertMemberCanAccessConversation(
            memberId,
            orgId,
            conversationId,
          );
          const { data: phoneRow, error: phoneError } = await supabaseAdmin
            .from("conversations")
            .select("external_phone")
            .eq("id", conversation.id)
            .single();

          if (phoneError || !phoneRow?.external_phone) {
            throw new Error("Client phone number is missing on this conversation");
          }
          externalPhone = phoneRow.external_phone;
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

          const title =
            `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() ||
            normalizedPhone;

          const conversation = await ensureClientConversation({
            orgId,
            externalPhone: normalizedPhone,
            contactId: contact.id,
            dealId:
              payload.deal_id != null && Number.isFinite(Number(payload.deal_id))
                ? Number(payload.deal_id)
                : null,
            createdByMemberId: memberId,
            title,
          });

          conversationId = Number(conversation.id);
          externalPhone = conversation.external_phone ?? normalizedPhone;
        }

        const twilioResponse = await sendTwilioSms({
          accountSid,
          authToken,
          from: fromNumber,
          to: externalPhone!,
          body,
          mediaUrls,
        });

        const messageBody =
          body ||
          (mediaUrls.some((url) => /\.(jpe?g|png|gif|webp)(\?|$)/i.test(url))
            ? "Photo"
            : "Attachment");

        const message = await insertSmsMessage({
          conversationId,
          body: messageBody,
          direction: "outbound",
          authorMemberId: memberId,
          externalId: twilioResponse.sid ?? null,
          mediaUrl: mediaUrls[0] ?? null,
        });

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
