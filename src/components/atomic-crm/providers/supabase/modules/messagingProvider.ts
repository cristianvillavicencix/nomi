import type { Identifier } from "ra-core";
import type { PhoneNumberAndType } from "../../../types";
import { normalizeUsPhoneToE164 } from "@/utils/phone";
import { supabase } from "../supabase";
import {
  invokeEdgeFunction,
  readEdgeFunctionErrorMessage,
} from "../invokeEdgeFunction";

const looksLikeUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

const resolveOrganizationMemberId = async (
  id: Identifier,
): Promise<Identifier> => {
  if (typeof id !== "string" || !looksLikeUuid(id)) {
    return id;
  }

  const { data, error } = await supabase
    .from("organization_members")
    .select("id")
    .eq("user_id", id)
    .single();

  if (error || !data?.id) {
    return id;
  }

  return data.id as Identifier;
};

export const messagingProvider = {
  async getMessagingSettings() {
    const disabledSettings: import("@/modules/types").MessagingSettingsPublic = {
      org_id: 0,
      twilio_account_sid: null,
      twilio_phone_number: null,
      sms_enabled: false,
      has_auth_token: false,
      webhook_url: null,
    };

    const { data, error } = await invokeEdgeFunction<
      import("@/modules/types").MessagingSettingsPublic
    >("messaging_settings", {
      method: "POST",
      body: { action: "get" },
    });
    if (error || !data) {
      console.warn("getMessagingSettings.error", error);
      return disabledSettings;
    }
    return data;
  },
  async updateMessagingSettings(params: {
    twilio_account_sid?: string | null;
    twilio_auth_token?: string | null;
    twilio_phone_number?: string | null;
    sms_enabled?: boolean;
    business_hours?: import("@/modules/types").BusinessHoursConfig | null;
    out_of_hours_message?: string | null;
    auto_acknowledge_enabled?: boolean;
    auto_acknowledge_message?: string | null;
  }) {
    const { data, error } = await invokeEdgeFunction<
      import("@/modules/types").MessagingSettingsPublic
    >("messaging_settings", {
      method: "POST",
      body: {
        action: "update",
        ...params,
      },
    });
    if (error) {
      throw new Error(
        (error as { message?: string }).message ??
          "Failed to save messaging settings",
      );
    }
    if (!data) {
      throw new Error("Failed to save messaging settings");
    }
    return data;
  },
  async getEmailDeliverySettings() {
    const fallback: import("@/modules/settings/EmailDeliverySettingsSection").EmailDeliverySettings =
      {
        configured: false,
        provider: null,
        from_email: null,
        reply_to: null,
        org_name: null,
      };

    const { data, error } = await invokeEdgeFunction<
      import("@/modules/settings/EmailDeliverySettingsSection").EmailDeliverySettings
    >("email_settings", {
      method: "POST",
      body: { action: "get" },
    });
    if (error || !data) {
      console.warn("getEmailDeliverySettings.error", error);
      return fallback;
    }
    return data;
  },
  async updateEmailDeliverySettings(params: { reply_to?: string | null }) {
    const { data, error } = await invokeEdgeFunction<
      import("@/modules/settings/EmailDeliverySettingsSection").EmailDeliverySettings
    >("email_settings", {
      method: "POST",
      body: { action: "update", ...params },
    });
    if (error) {
      throw new Error(
        (error as { message?: string }).message ??
          "Failed to save email settings",
      );
    }
    if (!data) {
      throw new Error("Failed to save email settings");
    }
    return data;
  },
  async sendTestTransactionalEmail(testEmail: string) {
    const { data, error } = await invokeEdgeFunction<{ ok: boolean }>(
      "email_settings",
      {
        method: "POST",
        body: { action: "test", test_email: testEmail },
      },
    );
    if (error) {
      throw new Error(
        (error as { message?: string }).message ?? "Failed to send test email",
      );
    }
    if (!data?.ok) {
      throw new Error("Failed to send test email");
    }
    return data;
  },
  async sendTestSms(testPhone: string) {
    const { data, error } = await invokeEdgeFunction<{ ok?: boolean }>(
      "messaging_settings",
      {
        method: "POST",
        body: {
          action: "test_sms",
          test_phone: testPhone,
        },
      },
    );
    if (error) {
      throw new Error(
        (error as { message?: string }).message ?? "Failed to send test SMS",
      );
    }
    if (!data?.ok) {
      throw new Error("Failed to send test SMS");
    }
    return data;
  },
  async sendMeetingLink({
    contactId,
    to,
    meetingUrl,
    title,
    greeting,
    intro,
    signature,
  }: {
    contactId?: Identifier;
    to?: string;
    meetingUrl: string;
    title?: string;
    greeting?: string;
    intro?: string;
    signature?: string;
  }) {
    const { data, error } = await invokeEdgeFunction<{
      sent: boolean;
      to: string;
      meeting_url: string;
    }>("send_meeting_link", {
      method: "POST",
      body: {
        meeting_url: meetingUrl,
        ...(contactId != null ? { contact_id: Number(contactId) } : {}),
        ...(to ? { to } : {}),
        ...(title ? { title } : {}),
        ...(greeting ? { greeting } : {}),
        ...(intro ? { intro } : {}),
        ...(signature ? { signature } : {}),
      },
    });

    if (error || !data?.sent) {
      console.error("sendMeetingLink.error", error);
      throw new Error(
        error
          ? await readEdgeFunctionErrorMessage(
              error,
              "Could not send meeting link",
            )
          : "Could not send meeting link",
      );
    }

    return data;
  },
  async sendClientSms(params: {
    conversationId?: Identifier;
    contactId?: Identifier;
    dealId?: Identifier | null;
    body: string;
    mediaUrls?: string[];
    isInternalNote?: boolean;
    templateId?: Identifier;
    replyToMessageId?: Identifier | null;
  }) {
    const { data, error } = await invokeEdgeFunction<{
      message?: import("@/modules/types").ConversationMessage;
      conversation?: import("@/modules/types").Conversation;
    }>("send_client_sms", {
      method: "POST",
      body: {
        conversation_id:
          params.conversationId != null
            ? Number(params.conversationId)
            : undefined,
        contact_id:
          params.contactId != null ? Number(params.contactId) : undefined,
        deal_id:
          params.dealId != null && params.dealId !== ""
            ? Number(params.dealId)
            : undefined,
        body: params.body,
        media_urls: params.mediaUrls,
        is_internal_note: params.isInternalNote === true,
        template_id:
          params.templateId != null ? Number(params.templateId) : undefined,
        reply_to_message_id:
          params.replyToMessageId != null
            ? Number(params.replyToMessageId)
            : undefined,
      },
    });
    if (error) {
      const response = (error as { context?: Response }).context;
      if (response) {
        try {
          const payload = (await response.clone().json()) as {
            message?: string;
          };
          if (payload?.message) {
            throw new Error(payload.message);
          }
        } catch (parseError) {
          if (
            parseError instanceof Error &&
            parseError.message !== "Failed to send SMS"
          ) {
            throw parseError;
          }
        }
      }
      throw new Error(
        (error as { message?: string }).message ?? "Failed to send SMS",
      );
    }
    return {
      message: data?.message ?? null,
      conversation: data?.conversation ?? null,
    };
  },
  async findClientConversationForContact(contactId: Identifier) {
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("id, phone_jsonb")
      .eq("id", contactId)
      .maybeSingle();

    if (contactError || !contact?.id) {
      return null;
    }

    const phoneJsonb = contact.phone_jsonb as
      | PhoneNumberAndType[]
      | null
      | undefined;
    let externalPhone: string | null = null;
    for (const entry of phoneJsonb ?? []) {
      const normalized = normalizeUsPhoneToE164(entry.number ?? "");
      if (normalized) {
        externalPhone = normalized;
        break;
      }
    }

    if (!externalPhone) {
      return null;
    }

    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("type", "client")
      .eq("external_phone", externalPhone)
      .maybeSingle();

    if (error) {
      throw new Error(error.message ?? "Failed to load client conversation");
    }

    return (data as import("@/modules/types").Conversation | null) ?? null;
  },
  async ensureClientConversation(params: {
    contactId: Identifier;
    authorMemberId: Identifier;
    dealId?: Identifier | null;
  }) {
    const authorMemberId = await resolveOrganizationMemberId(
      params.authorMemberId,
    );

    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, phone_jsonb")
      .eq("id", params.contactId)
      .maybeSingle();

    if (contactError || !contact?.id) {
      throw new Error("Contact not found");
    }

    const phoneJsonb = contact.phone_jsonb as
      | PhoneNumberAndType[]
      | null
      | undefined;
    let externalPhone: string | null = null;
    for (const entry of phoneJsonb ?? []) {
      const normalized = normalizeUsPhoneToE164(entry.number ?? "");
      if (normalized) {
        externalPhone = normalized;
        break;
      }
    }

    if (!externalPhone) {
      throw new Error("This contact has no valid phone number");
    }

    const findExisting = async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("type", "client")
        .eq("external_phone", externalPhone)
        .maybeSingle();

      if (error) {
        throw new Error(error.message ?? "Failed to load client conversation");
      }

      return data;
    };

    const existing = await findExisting();
    if (existing) {
      return existing as import("@/modules/types").Conversation;
    }

    const title =
      `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() ||
      externalPhone;

    const payload: Record<string, unknown> = {
      type: "client",
      title,
      contact_id: contact.id,
      external_phone: externalPhone,
      created_by_member_id: authorMemberId,
    };

    if (params.dealId != null && params.dealId !== "") {
      const { data: deal } = await supabase
        .from("deals")
        .select("id")
        .eq("id", params.dealId)
        .maybeSingle();
      if (deal?.id) {
        payload.deal_id = deal.id;
      }
    }

    const { data: created, error: createError } = await supabase
      .from("conversations")
      .insert(payload)
      .select("*")
      .single();

    if (createError) {
      if (createError.code === "23505") {
        const retry = await findExisting();
        if (retry) {
          return retry as import("@/modules/types").Conversation;
        }
      }
      throw new Error(
        createError.message ?? "Failed to create client conversation",
      );
    }

    return created as import("@/modules/types").Conversation;
  },
  async notifyFollowUp(params: {
    calendarEventId: Identifier;
    kind?: "scheduled" | "reminder";
    appBaseUrl?: string | null;
  }) {
    const { data, error } = await invokeEdgeFunction<{
      ok?: boolean;
      sent?: boolean;
      reason?: string;
      calendarEventId?: number;
    }>("notify_follow_up", {
      method: "POST",
      body: {
        calendar_event_id: Number(params.calendarEventId),
        kind: params.kind ?? "scheduled",
        app_base_url: params.appBaseUrl ?? undefined,
      },
    });
    if (error) {
      throw new Error(
        await readEdgeFunctionErrorMessage(
          error,
          "Failed to send follow-up notification",
        ),
      );
    }
    return data ?? { ok: true, sent: false };
  },
};
