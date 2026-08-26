import type { Identifier } from "ra-core";
import type { PhoneNumberAndType } from "../../../types";
import { normalizeUsPhoneToE164 } from "@/utils/phone";
import { supabase } from "../supabase";
import {
  invokeEdgeFunction,
  readEdgeFunctionErrorMessage,
} from "../invokeEdgeFunction";
import {
  DEFAULT_TICKET_WORKSPACE_SETTINGS,
  type TicketWorkspaceSettingsResponse,
} from "@/modules/settings/tickets/ticketWorkspaceSettings";

const looksLikeUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

const normalizeStripeClientSettings = (
  raw: Record<string, unknown> | null | undefined,
): import("@/modules/settings/integrations/stripeClientSettings").StripeClientSettings => {
  const credentialMode =
    raw?.stripe_credential_mode === "settings"
      ? "settings"
      : raw?.credential_source === "database"
        ? "settings"
        : "server";

  const serverKeys =
    raw?.server_keys_configured === true ||
    (credentialMode === "server" && raw?.secret_key_configured === true) ||
    raw?.credential_source === "environment";

  const settingsKeys =
    raw?.settings_keys_configured === true ||
    (credentialMode === "settings" && raw?.secret_key_configured === true) ||
    raw?.credential_source === "database";

  const invoiceEnabled =
    raw?.invoice_payments_enabled !== undefined
      ? raw.invoice_payments_enabled === true
      : true;

  const paymentLinkEnabled = invoiceEnabled;

  const proposalEnabled =
    raw?.proposal_payments_enabled !== undefined
      ? raw.proposal_payments_enabled === true
      : raw?.client_payments_enabled === true;

  const secretConfigured =
    credentialMode === "settings" ? settingsKeys : serverKeys;

  const anyChannel = invoiceEnabled || paymentLinkEnabled || proposalEnabled;
  const paymentStatus =
    raw?.payment_status === "live" ||
    raw?.payment_status === "paused" ||
    raw?.payment_status === "not_configured"
      ? raw.payment_status
      : !secretConfigured
        ? "not_configured"
        : anyChannel
          ? "live"
          : "paused";

  return {
    org_id: typeof raw?.org_id === "number" ? raw.org_id : 0,
    stripe_credential_mode: credentialMode,
    credential_mode_label:
      typeof raw?.credential_mode_label === "string"
        ? raw.credential_mode_label
        : credentialMode === "settings"
          ? "Manual (Settings)"
          : "Supabase server",
    invoice_payments_enabled: invoiceEnabled,
    payment_link_payments_enabled: paymentLinkEnabled,
    proposal_payments_enabled: proposalEnabled,
    save_cards_default:
      raw?.save_cards_default !== undefined
        ? raw.save_cards_default === true
        : true,
    configured: raw?.configured === true || secretConfigured,
    payment_status: paymentStatus,
    payment_status_label:
      typeof raw?.payment_status_label === "string"
        ? raw.payment_status_label
        : paymentStatus === "live"
          ? "Card payments on"
          : paymentStatus === "paused"
            ? "Card payments paused"
            : "Not set up",
    credential_source:
      raw?.credential_source === "database" ||
      raw?.credential_source === "environment" ||
      raw?.credential_source === "none"
        ? raw.credential_source
        : credentialMode === "settings"
          ? "database"
          : serverKeys
            ? "environment"
            : "none",
    connection_label:
      typeof raw?.connection_label === "string"
        ? raw.connection_label
        : secretConfigured
          ? credentialMode === "server"
            ? "Connected (Supabase server)"
            : "Connected (Settings)"
          : "Not configured",
    server_keys_configured: serverKeys,
    settings_keys_configured: settingsKeys,
    stripe_publishable_key:
      typeof raw?.stripe_publishable_key === "string"
        ? raw.stripe_publishable_key
        : null,
    publishable_key_preview:
      typeof raw?.publishable_key_preview === "string"
        ? raw.publishable_key_preview
        : null,
    publishable_key_configured: raw?.publishable_key_configured === true,
    secret_key_configured: secretConfigured,
    webhook_secret_configured: raw?.webhook_secret_configured === true,
    has_secret_key: raw?.has_secret_key === true || secretConfigured,
    has_webhook_secret: raw?.has_webhook_secret === true,
    webhook_url:
      typeof raw?.webhook_url === "string" ? raw.webhook_url : null,
  };
};

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
    const disabledSettings: import("@/modules/types").MessagingSettingsPublic =
      {
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
      return disabledSettings;
    }
    return data;
  },
  async updateMessagingSettings(params: {
    messaging_provider?: "twilio" | "telnyx";
    twilio_account_sid?: string | null;
    twilio_auth_token?: string | null;
    twilio_phone_number?: string | null;
    sms_enabled?: boolean;
    telnyx_api_key?: string | null;
    telnyx_phone_number?: string | null;
    telnyx_messaging_profile_id?: string | null;
    telnyx_sip_connection_id?: string | null;
    telnyx_telephony_credential_id?: string | null;
    telnyx_sip_username?: string | null;
    telnyx_sip_password?: string | null;
    telnyx_caller_id?: string | null;
    business_hours?: import("@/modules/types").BusinessHoursConfig | null;
    out_of_hours_message?: string | null;
    auto_acknowledge_enabled?: boolean;
    auto_acknowledge_message?: string | null;
    voice_enabled?: boolean;
    voice_twiml_app_sid?: string | null;
    voice_api_key_sid?: string | null;
    voice_api_key_secret?: string | null;
    voice_caller_id?: string | null;
    voice_recording_default?: boolean;
    twilio_marketing_messaging_service_sid?: string | null;
    twilio_marketing_phone_number?: string | null;
    marketing_email_from?: string | null;
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
  async getVoiceToken() {
    const { data, error } = await invokeEdgeFunction<{
      token: string;
      identity: string;
      provider?: "twilio" | "telnyx";
      caller_id?: string | null;
      login?: string | null;
      password?: string | null;
    }>("voice_token", {
      method: "POST",
      body: {},
    });
    if (error || (!data?.token && !(data?.login && data?.password))) {
      throw new Error(
        await readEdgeFunctionErrorMessage(
          error ?? { message: "Voice calling is not configured" },
          "Voice calling is not configured",
        ),
      );
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
  async updateEmailDeliverySettings(params: {
    reply_to?: string | null;
    general_from_email?: string | null;
    billing_from_email?: string | null;
    general_email_enabled?: boolean;
    billing_email_enabled?: boolean;
    ticket_inbox_email?: string | null;
    ticket_inbox_enabled?: boolean;
  }) {
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
  async getTicketWorkspaceSettings() {
    const fallback: TicketWorkspaceSettingsResponse = {
      workspace: { ...DEFAULT_TICKET_WORKSPACE_SETTINGS },
      inboxes: [],
      health: {
        webhook_configured: false,
        outbound_configured: false,
        last_inbound_at: null,
        last_inbound_inbox_email: null,
      },
    };
    const { data, error } = await invokeEdgeFunction<TicketWorkspaceSettingsResponse>(
      "ticket_settings",
      {
        method: "POST",
        body: { action: "get" },
      },
    );
    if (error || !data) {
      console.warn("getTicketWorkspaceSettings.error", error);
      return fallback;
    }
    return data;
  },
  async updateTicketWorkspaceSettings(params: {
    workspace?: Partial<
      import("@/modules/settings/tickets/ticketWorkspaceSettings").TicketWorkspaceSettings
    >;
    inbox?: Record<string, unknown> & { id: number };
    create_inbox?: {
      email: string;
      display_name?: string | null;
      from_name?: string | null;
    };
  }) {
    const { data, error } = await invokeEdgeFunction<TicketWorkspaceSettingsResponse>(
      "ticket_settings",
      {
        method: "POST",
        body: { action: "update", ...params },
      },
    );
    if (error) {
      throw new Error(
        (error as { message?: string }).message ??
          "Failed to save ticket settings",
      );
    }
    if (!data) throw new Error("Failed to save ticket settings");
    return data;
  },
  async sendTestTicketOutboundEmail(testEmail: string) {
    const { data, error } = await invokeEdgeFunction<{ ok: boolean }>(
      "ticket_settings",
      {
        method: "POST",
        body: { action: "test_outbound", test_email: testEmail },
      },
    );
    if (error) {
      throw new Error(
        (error as { message?: string }).message ?? "Failed to send test email",
      );
    }
    if (!data?.ok) throw new Error("Failed to send test email");
    return data;
  },
  async sendTicketCsatEmail(ticketId: number) {
    const { data, error } = await invokeEdgeFunction<{ ok?: boolean; skipped?: boolean }>(
      "ticket_settings",
      {
        method: "POST",
        body: { action: "send_csat", ticket_id: ticketId },
      },
    );
    if (error) {
      throw new Error(
        (error as { message?: string }).message ?? "Failed to send CSAT email",
      );
    }
    return data ?? { ok: false };
  },
  async dismissTicketInboundFailure(failureId: number) {
    const { data, error } = await invokeEdgeFunction<{
      ok: boolean;
      health?: import("@/modules/settings/tickets/ticketWorkspaceSettings").TicketSettingsHealth;
    }>("ticket_settings", {
      method: "POST",
      body: { action: "dismiss_inbound_failure", failure_id: failureId },
    });
    if (error) {
      throw new Error(
        (error as { message?: string }).message ??
          "Failed to dismiss inbound failure",
      );
    }
    return data ?? { ok: false };
  },
  async retryTicketInboundFailure(failureId: number) {
    const { data, error } = await invokeEdgeFunction<{
      ok: boolean;
      ticket_id?: number;
      health?: import("@/modules/settings/tickets/ticketWorkspaceSettings").TicketSettingsHealth;
    }>("ticket_settings", {
      method: "POST",
      body: { action: "retry_inbound_failure", failure_id: failureId },
    });
    if (error) {
      throw new Error(
        (error as { message?: string }).message ??
          "Failed to retry inbound failure",
      );
    }
    if (!data?.ok) {
      throw new Error("Failed to retry inbound failure");
    }
    return data;
  },
  async importTicketEmail(file: File) {
    const form = new FormData();
    form.append("file", file);
    const { data, error } = await invokeEdgeFunction<{
      ok?: boolean;
      ticket_id?: number;
      skipped_attachments?: number;
      companycam?: boolean;
    }>("import_ticket_email", {
      method: "POST",
      body: form,
    });
    if (error) {
      throw new Error(
        (error as { message?: string }).message ?? "Failed to import email",
      );
    }
    if (!data?.ok || !data.ticket_id) {
      throw new Error("Failed to import email");
    }
    return data;
  },
  async getStripeClientSettings() {
    const fallback: import("@/modules/settings/integrations/stripeClientSettings").StripeClientSettings =
      {
        org_id: 0,
        stripe_credential_mode: "server",
        credential_mode_label: "Supabase server",
        invoice_payments_enabled: true,
        payment_link_payments_enabled: true,
        proposal_payments_enabled: false,
        save_cards_default: true,
        configured: false,
        payment_status: "not_configured",
        payment_status_label: "Not set up",
        credential_source: "none",
        connection_label: "Not configured",
        server_keys_configured: false,
        settings_keys_configured: false,
        stripe_publishable_key: null,
        publishable_key_preview: null,
        publishable_key_configured: false,
        secret_key_configured: false,
        webhook_secret_configured: false,
        has_secret_key: false,
        has_webhook_secret: false,
        webhook_url: null,
      };

    const { data, error } = await invokeEdgeFunction<
      import("@/modules/settings/integrations/stripeClientSettings").StripeClientSettings
    >("stripe_settings", {
      method: "POST",
      body: { action: "get" },
    });
    if (error || !data) {
      console.warn("getStripeClientSettings.error", error);
      return fallback;
    }
    return normalizeStripeClientSettings(
      data as unknown as Record<string, unknown>,
    );
  },
  async updateStripeClientSettings(params: {
    stripe_credential_mode?: "server" | "settings";
    invoice_payments_enabled?: boolean;
    proposal_payments_enabled?: boolean;
    save_cards_default?: boolean;
    stripe_publishable_key?: string | null;
    stripe_secret_key?: string | null;
    stripe_webhook_secret?: string | null;
  }) {
    const { data, error } = await invokeEdgeFunction<
      import("@/modules/settings/integrations/stripeClientSettings").StripeClientSettings
    >("stripe_settings", {
      method: "POST",
      body: { action: "update", ...params },
    });
    if (error) {
      throw new Error(
        (error as { message?: string }).message ?? "Failed to save Stripe settings",
      );
    }
    if (!data) {
      throw new Error("Failed to save Stripe settings");
    }
    return normalizeStripeClientSettings(
      data as unknown as Record<string, unknown>,
    );
  },
  async testStripeClientSettings() {
    const { data, error } = await invokeEdgeFunction<{ ok: boolean }>(
      "stripe_settings",
      {
        method: "POST",
        body: { action: "test" },
      },
    );
    if (error) {
      throw new Error(
        (error as { message?: string }).message ?? "Stripe test failed",
      );
    }
    if (!data?.ok) {
      throw new Error("Stripe test failed");
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
    body?: string;
    mediaUrls?: string[];
    isInternalNote?: boolean;
    templateId?: Identifier;
    replyToMessageId?: Identifier | null;
    externalPhone?: string | null;
    resendMessageId?: Identifier;
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
        external_phone:
          params.externalPhone != null && params.externalPhone !== ""
            ? params.externalPhone
            : undefined,
        resend_message_id:
          params.resendMessageId != null
            ? Number(params.resendMessageId)
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
  async findClientConversationForContact(
    contactId: Identifier,
    externalPhone?: string | null,
  ) {
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
    let resolvedPhone: string | null = null;
    if (externalPhone != null && externalPhone !== "") {
      resolvedPhone = normalizeUsPhoneToE164(externalPhone);
    } else {
      for (const entry of phoneJsonb ?? []) {
        const normalized = normalizeUsPhoneToE164(entry.number ?? "");
        if (normalized) {
          resolvedPhone = normalized;
          break;
        }
      }
    }

    if (!resolvedPhone) {
      return null;
    }

    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("type", "client")
      .eq("external_phone", resolvedPhone)
      .maybeSingle();

    if (error) {
      throw new Error(error.message ?? "Failed to load client conversation");
    }

    return (data as import("@/modules/types").Conversation | null) ?? null;
  },
  async findClientConversationByPhone(externalPhone: string) {
    const resolvedPhone = normalizeUsPhoneToE164(externalPhone);
    if (!resolvedPhone) {
      return null;
    }

    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("type", "client")
      .eq("external_phone", resolvedPhone)
      .maybeSingle();

    if (error) {
      throw new Error(error.message ?? "Failed to load client conversation");
    }

    return (data as import("@/modules/types").Conversation | null) ?? null;
  },
  async lookupContactByPhone(phone: string) {
    const { data, error } = await invokeEdgeFunction<{
      contact: {
        id: number;
        first_name: string | null;
        last_name: string | null;
        full_name: string | null;
        company_id: number | null;
        company_name: string | null;
      } | null;
    }>("lookup_contact_by_phone", {
      method: "POST",
      body: { phone },
    });
    if (error) {
      return null;
    }
    return data?.contact ?? null;
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
    kind?: "scheduled" | "reminder" | "rescheduled";
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
  async notifyMeetingScheduled(params: {
    calendarEventId: Identifier;
    shareEmail?: boolean;
    shareSms?: boolean;
    appBaseUrl?: string | null;
  }) {
    const { data, error } = await invokeEdgeFunction<{
      ok?: boolean;
      calendar_url?: string | null;
      host_sms?: { sent: boolean; reason?: string };
      client_email?: { sent: boolean; reason?: string };
      client_sms?: { sent: boolean; reason?: string };
    }>("notify_meeting_scheduled", {
      method: "POST",
      body: {
        calendar_event_id: Number(params.calendarEventId),
        share_email: params.shareEmail === true,
        share_sms: params.shareSms === true,
        app_base_url: params.appBaseUrl ?? undefined,
      },
    });
    if (error) {
      throw new Error(
        await readEdgeFunctionErrorMessage(
          error,
          "Failed to send meeting notifications",
        ),
      );
    }
    return (
      data ?? {
        ok: true,
        calendar_url: null,
        host_sms: { sent: false },
        client_email: { sent: false },
        client_sms: { sent: false },
      }
    );
  },
  async notifyMeetingRescheduled(params: {
    calendarEventId: Identifier;
    shareEmail?: boolean;
    shareSms?: boolean;
    appBaseUrl?: string | null;
  }) {
    const { data, error } = await invokeEdgeFunction<{
      ok?: boolean;
      calendar_url?: string | null;
      host_sms?: { sent: boolean; reason?: string };
      client_email?: { sent: boolean; reason?: string };
      client_sms?: { sent: boolean; reason?: string };
    }>("notify_meeting_rescheduled", {
      method: "POST",
      body: {
        calendar_event_id: Number(params.calendarEventId),
        share_email: params.shareEmail === true,
        share_sms: params.shareSms === true,
        app_base_url: params.appBaseUrl ?? undefined,
      },
    });
    if (error) {
      throw new Error(
        await readEdgeFunctionErrorMessage(
          error,
          "Failed to send meeting reschedule notifications",
        ),
      );
    }
    return (
      data ?? {
        ok: true,
        calendar_url: null,
        host_sms: { sent: false },
        client_email: { sent: false },
        client_sms: { sent: false },
      }
    );
  },
  async syncCalendarEventBooking(params: {
    calendarEventId: Identifier;
    appBaseUrl?: string | null;
  }) {
    const { data, error } = await invokeEdgeFunction<{
      ok?: boolean;
      has_booking?: boolean;
      booking_id?: number | null;
      host_notify?: { ok?: boolean; sent?: boolean; reason?: string };
      guest_confirmation?: { sent: boolean; reason?: string };
    }>("sync_calendar_event_update", {
      method: "POST",
      body: {
        calendar_event_id: Number(params.calendarEventId),
        app_base_url: params.appBaseUrl ?? undefined,
      },
    });
    if (error) {
      throw new Error(
        await readEdgeFunctionErrorMessage(
          error,
          "Failed to sync public booking",
        ),
      );
    }
    return (
      data ?? {
        ok: true,
        has_booking: false,
      }
    );
  },
  async notifyTaskRescheduled(params: {
    taskId: Identifier;
    previousDueDate?: string | null;
    appBaseUrl?: string | null;
  }) {
    const { data, error } = await invokeEdgeFunction<{
      ok?: boolean;
      recipients?: number;
      sent?: number;
      skipped?: number;
      reasons?: string[];
    }>("notify_task_rescheduled", {
      method: "POST",
      body: {
        task_id: Number(params.taskId),
        previous_due_date: params.previousDueDate ?? null,
        app_base_url: params.appBaseUrl ?? undefined,
      },
    });
    if (error) {
      throw new Error(
        await readEdgeFunctionErrorMessage(
          error,
          "Failed to send task reschedule notifications",
        ),
      );
    }
    return (
      data ?? {
        ok: true,
        recipients: 0,
        sent: 0,
        skipped: 0,
        reasons: [],
      }
    );
  },
  async ensureTeamDmConversation(params: { otherMemberId: Identifier }) {
    const { data, error } = await supabase.rpc("ensure_team_dm_conversation", {
      p_other_member_id: Number(params.otherMemberId),
    });

    if (error) {
      console.error("ensureTeamDmConversation.error", error);
      throw new Error(error.message || "Failed to open direct message");
    }

    return data as Identifier;
  },
};
