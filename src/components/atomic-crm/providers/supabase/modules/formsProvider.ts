import { invokeEdgeFunction } from "../invokeEdgeFunction";
import { supabase } from "../supabase";

export const formsProvider = {
  async submitProjectResources(payload: {
    dealId: string | number;
    companyId?: string | number | null;
    contactId?: string | number | null;
    items: Array<{
      category: string;
      label?: string;
      name: string;
      content: string;
      content_type?: string;
    }>;
  }) {
    const { data, error } = await supabase.functions.invoke<{
      deal_id: number;
      count: number;
    }>("submit_project_resources", {
      body: {
        deal_id: Number(payload.dealId),
        company_id: payload.companyId ? Number(payload.companyId) : undefined,
        contact_id: payload.contactId ? Number(payload.contactId) : undefined,
        items: payload.items,
      },
      headers: {
        apikey: import.meta.env.VITE_SB_PUBLISHABLE_KEY,
      },
    });

    if (error || !data) {
      console.error("submit_project_resources.error", error);
      throw new Error("Failed to upload project resources");
    }

    return data;
  },
  async getFormByToken(payload: { token: string }) {
    const { data, error } = await supabase.functions.invoke<{
      token: string;
      is_preview?: boolean;
      form: {
        id: number;
        name: string;
        slug: string;
        description?: string | null;
        schema: Record<string, unknown>;
        type: string;
        logo_url?: string | null;
        primary_color?: string | null;
        background_image_url?: string | null;
        welcome_title?: string | null;
        welcome_message?: string | null;
        thank_you_title?: string | null;
        thank_you_message?: string | null;
        recaptcha_enabled?: boolean;
        honeypot_enabled?: boolean;
        custom_font_url?: string | null;
        custom_css?: string | null;
      };
      prefill?: Record<string, unknown>;
      links?: {
        contact_id?: number | null;
        company_id?: number | null;
        deal_id?: number | null;
      };
    }>("get_form_by_token", {
      body: { token: payload.token },
      headers: {
        apikey: import.meta.env.VITE_SB_PUBLISHABLE_KEY,
      },
    });

    if (error || !data?.form) {
      console.error("get_form_by_token.error", error);
      throw new Error("Form not found or link expired");
    }

    return data;
  },
  async submitFormV2(payload: {
    token: string;
    answers: Record<string, unknown>;
    recaptchaToken?: string;
    honeypot?: string;
    metadata?: {
      source_url?: string;
      utm_source?: string;
      utm_medium?: string;
      utm_campaign?: string;
      app_base_url?: string;
      brief_sections?: string[];
    };
  }) {
    const { data, error } = await supabase.functions.invoke<{
      ok?: boolean;
      preview?: boolean;
      error?: string;
      details?: string[];
      submission_id?: number;
      thank_you_title?: string;
      thank_you_message?: string;
      redirect_url?: string | null;
    }>("submit_form_v2", {
      body: {
        token: payload.token,
        answers: payload.answers,
        recaptcha_token: payload.recaptchaToken,
        honeypot: payload.honeypot,
        metadata: {
          ...payload.metadata,
          app_base_url:
            payload.metadata?.app_base_url ?? window.location.origin,
          source_url: payload.metadata?.source_url ?? window.location.href,
        },
      },
      headers: {
        apikey: import.meta.env.VITE_SB_PUBLISHABLE_KEY,
      },
    });

    if (error || !data?.ok) {
      let responseBody = data;
      if (error && !responseBody?.error) {
        try {
          const context = (error as { context?: Response }).context;
          if (context) {
            responseBody = (await context.json()) as typeof data;
          }
        } catch {
          // ignore malformed error body
        }
      }
      const detail = responseBody?.details?.length
        ? `: ${responseBody.details.join(", ")}`
        : "";
      const message =
        (responseBody?.error ?? error?.message ?? "Failed to submit form") +
        detail;
      console.error("submit_form_v2.error", error ?? message, responseBody);
      throw new Error(message);
    }

    return data;
  },
  async generateFormToken(payload: {
    formInstanceId: number;
    contactId?: number | null;
    companyId?: number | null;
    dealId?: number | null;
    expiresInDays?: number;
    maxUses?: number | null;
    baseUrl?: string;
    isPreview?: boolean;
  }) {
    const { data, error } = await invokeEdgeFunction<{
      token: string;
      short_code?: string;
      url: string;
      short_url?: string;
      expires_at: string;
      max_uses: number | null;
      form_instance_id: number;
      form_name: string;
    }>("generate_form_token", {
      method: "POST",
      body: {
        form_instance_id: payload.formInstanceId,
        contact_id: payload.contactId ?? null,
        company_id: payload.companyId ?? null,
        deal_id: payload.dealId ?? null,
        expires_in_days: payload.expiresInDays ?? 30,
        max_uses: payload.maxUses ?? 1,
        base_url: payload.baseUrl ?? window.location.origin,
        is_preview: payload.isPreview ?? false,
      },
    });

    if (error || !data?.token) {
      console.error("generate_form_token.error", error);
      throw new Error("Failed to generate form link");
    }

    return data;
  },
  async recordFormEvent(payload: {
    token: string;
    event_type: "started" | "field_completed" | "field_focused" | "abandoned";
    field_key?: string;
  }) {
    const { data, error } = await supabase.functions.invoke<{ ok?: boolean }>(
      "record_form_event",
      {
        body: payload,
        headers: {
          apikey: import.meta.env.VITE_SB_PUBLISHABLE_KEY,
        },
      },
    );

    if (error) {
      console.error("record_form_event.error", error);
      throw new Error("Failed to record form event");
    }

    if (!data?.ok) {
      throw new Error("Failed to record form event");
    }

    return data;
  },
};
