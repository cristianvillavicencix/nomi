import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { buildBriefPrefillFromCrm } from "../_shared/briefPrefill.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";

type GetFormBody = {
  token?: string;
};

Deno.serve(
  OptionsMiddleware(async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    try {
      const body = (await req.json()) as GetFormBody;
      const token = String(body.token ?? "").trim();
      if (!token) {
        return createErrorResponse(400, "Missing form token");
      }

      const { data: tokenData, error: tokenError } = await supabaseAdmin
        .from("public_form_tokens")
        .select(
          `
          id,
          org_id,
          expires_at,
          max_uses,
          uses_count,
          is_preview,
          contact_id,
          company_id,
          deal_id,
          form_instance:form_instances (
            id,
            org_id,
            name,
            slug,
            description,
            schema,
            logo_url,
            primary_color,
            background_image_url,
            welcome_title,
            welcome_message,
            thank_you_title,
            thank_you_message,
            recaptcha_enabled,
            honeypot_enabled,
            custom_font_url,
            custom_css,
            is_active,
            template_id,
            form_templates ( type )
          )
        `,
        )
        .eq("token", token)
        .single();

      if (tokenError || !tokenData?.form_instance) {
        return createErrorResponse(404, "Invalid or expired form link");
      }

      if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
        return createErrorResponse(410, "This form link has expired");
      }

      if (
        tokenData.max_uses != null &&
        tokenData.uses_count >= tokenData.max_uses
      ) {
        return createErrorResponse(
          410,
          "This form link has reached its submission limit",
        );
      }

      const formInstance = tokenData.form_instance as Record<string, unknown>;
      if (formInstance.is_active === false) {
        return createErrorResponse(404, "This form is not available");
      }

      const clientIp =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
      const userAgent = req.headers.get("user-agent");

      await supabaseAdmin.from("form_submission_events").insert({
        org_id: tokenData.org_id,
        form_instance_id: formInstance.id,
        event_type: "viewed",
        ip_address: clientIp,
        user_agent: userAgent,
      });

      let prefill: Record<string, unknown> = {};
      if (tokenData.deal_id) {
        const { data: deal } = await supabaseAdmin
          .from("deals")
          .select("website_brief, project_type, name, company_id, contact_id")
          .eq("id", tokenData.deal_id)
          .maybeSingle();

        let contact = null;
        const contactId = tokenData.contact_id ?? deal?.contact_id;
        if (contactId) {
          const { data } = await supabaseAdmin
            .from("contacts")
            .select(
              "first_name, last_name, email_jsonb, phone_jsonb, address",
            )
            .eq("id", contactId)
            .maybeSingle();
          contact = data;
        }

        let company = null;
        const companyId = tokenData.company_id ?? deal?.company_id;
        if (companyId) {
          const { data } = await supabaseAdmin
            .from("companies")
            .select(
              "name, website, phone_number, address, city, state_abbr, zipcode",
            )
            .eq("id", companyId)
            .maybeSingle();
          company = data;
        }

        prefill = buildBriefPrefillFromCrm({ deal, contact, company });
      }

      const templateJoin = formInstance.form_templates as
        | { type?: string }
        | { type?: string }[]
        | null;
      const templateType = Array.isArray(templateJoin)
        ? templateJoin[0]?.type
        : templateJoin?.type;

      return new Response(
        JSON.stringify({
          token,
          is_preview: Boolean(tokenData.is_preview),
          form: {
            id: formInstance.id,
            name: formInstance.name,
            slug: formInstance.slug,
            description: formInstance.description,
            schema: formInstance.schema,
            type: templateType ?? "custom",
            logo_url: formInstance.logo_url,
            primary_color: formInstance.primary_color,
            background_image_url: formInstance.background_image_url,
            welcome_title: formInstance.welcome_title,
            welcome_message: formInstance.welcome_message,
            thank_you_title: formInstance.thank_you_title,
            thank_you_message: formInstance.thank_you_message,
            recaptcha_enabled: formInstance.recaptcha_enabled,
            honeypot_enabled: formInstance.honeypot_enabled,
            custom_font_url: formInstance.custom_font_url,
            custom_css: formInstance.custom_css,
          },
          prefill,
          links: {
            contact_id: tokenData.contact_id,
            company_id: tokenData.company_id,
            deal_id: tokenData.deal_id,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (error) {
      console.error("[get_form_by_token] error", error);
      return createErrorResponse(
        500,
        error instanceof Error ? error.message : "Unexpected error",
      );
    }
  }),
);
