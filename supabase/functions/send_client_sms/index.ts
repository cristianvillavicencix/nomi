import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { getMessagingSettingsSecrets } from "../_shared/messagingSettings.ts";
import {
  assertMemberCanAccessConversation,
  insertSmsMessage,
} from "../_shared/messagingConversations.ts";
import { sendTwilioSms } from "../_shared/twilio.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

type SendBody = {
  conversation_id?: number;
  body?: string;
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
        const conversationId = Number(payload.conversation_id);
        const body = payload.body?.trim();

        if (!Number.isFinite(conversationId) || !body) {
          throw new Error("conversation_id and body are required");
        }

        await assertMemberCanAccessConversation(memberId, orgId, conversationId);

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

        const { data: conversation, error: conversationError } =
          await supabaseAdmin
            .from("conversations")
            .select("external_phone")
            .eq("id", conversationId)
            .single();

        if (conversationError || !conversation?.external_phone) {
          throw new Error("Client phone number is missing on this conversation");
        }

        const twilioResponse = await sendTwilioSms({
          accountSid,
          authToken,
          from: fromNumber,
          to: conversation.external_phone,
          body,
        });

        const message = await insertSmsMessage({
          conversationId,
          body,
          direction: "outbound",
          authorMemberId: memberId,
          externalId: twilioResponse.sid ?? null,
        });

        return new Response(JSON.stringify({ message }), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to send SMS";
        return createErrorResponse(400, message);
      }
    });
  }),
);
