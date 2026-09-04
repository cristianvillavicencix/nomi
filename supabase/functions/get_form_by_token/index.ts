import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { buildBriefPrefillFromCrm } from "../_shared/briefPrefill.ts";
import { buildProjectResourcesPrefill } from "../_shared/projectResourcesPrefill.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { resolveStorageDisplayUrl } from "../_shared/storageObjectUrl.ts";
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
          request_scope,
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
            .select("first_name, last_name, email_jsonb, phone_jsonb, address")
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

        if (formInstance.slug === "project-resources" && tokenData.deal_id) {
          const resourcesPrefill = await buildProjectResourcesPrefill(
            supabaseAdmin,
            Number(tokenData.deal_id),
            deal?.website_brief as Record<string, unknown> | null,
          );
          prefill = { ...prefill, ...resourcesPrefill };
        }
      }

      const templateJoin = formInstance.form_templates as
        | { type?: string }
        | { type?: string }[]
        | null;
      const templateType = Array.isArray(templateJoin)
        ? templateJoin[0]?.type
        : templateJoin?.type;

      const formSlug = String(formInstance.slug ?? "");
      const isProjectBrief =
        formSlug === "project_brief" || templateType === "project_brief";
      const isProjectResources = formSlug === "project-resources";
      const useAgencyBranding = isProjectBrief || isProjectResources;

      const [{ data: orgRow }, { data: configRow }] = await Promise.all([
        supabaseAdmin
          .from("organizations")
          .select("name, email, phone, address, website")
          .eq("id", tokenData.org_id)
          .maybeSingle(),
        supabaseAdmin
          .from("configuration")
          .select("config")
          .eq("id", 1)
          .maybeSingle(),
      ]);

      const config =
        configRow?.config != null && typeof configRow.config === "object"
          ? (configRow.config as Record<string, unknown>)
          : {};
      const agencyName =
        String(orgRow?.name ?? "").trim() ||
        String(config.companyLegalName ?? "").trim() ||
        String(config.title ?? "").trim() ||
        "Latino Business Support";

      const configAddress = [
        config.companyAddressLine1,
        config.companyAddressLine2,
        [config.companyCity, config.companyState, config.companyPostalCode]
          .map((part) => String(part ?? "").trim())
          .filter(Boolean)
          .join(", "),
        config.companyCountry &&
        String(config.companyCountry).trim().toUpperCase() !== "US"
          ? config.companyCountry
          : null,
      ]
        .map((part) => String(part ?? "").trim())
        .filter(Boolean)
        .join(", ");

      const agencyPhone =
        String(config.companyPhone ?? "").trim() ||
        String(orgRow?.phone ?? "").trim() ||
        "4752570243";
      const agencyEmail =
        String(config.companyEmail ?? "").trim() ||
        String(orgRow?.email ?? "").trim() ||
        "info@lbs.bz";
      const agencyAddress =
        configAddress ||
        String(orgRow?.address ?? "").trim() ||
        "1200 Summer St, Stamford, CT 06902";
      const agencyWebsite =
        String(config.companyWebsite ?? "").trim() ||
        String(orgRow?.website ?? "").trim() ||
        "https://lbs.bz";

      const formLogoUrl = await resolveStorageDisplayUrl(
        supabaseAdmin,
        formInstance.logo_url as string | null | undefined,
        { defaultBucket: "form-branding", expiresIn: 60 * 60 * 24 },
      );
      const configLogoRaw =
        String(config.lightModeLogo ?? "").trim() ||
        String(config.darkModeLogo ?? "").trim() ||
        null;
      const configLogoUrl = configLogoRaw
        ? await resolveStorageDisplayUrl(supabaseAdmin, configLogoRaw, {
            defaultBucket: "attachments",
            expiresIn: 60 * 60 * 24,
          })
        : null;
      const logoUrl =
        formLogoUrl ||
        configLogoUrl ||
        (useAgencyBranding ? "/logos/sigma.png" : null);

      const backgroundImageUrl = await resolveStorageDisplayUrl(
        supabaseAdmin,
        formInstance.background_image_url as string | null | undefined,
        { defaultBucket: "form-branding", expiresIn: 60 * 60 * 24 },
      );

      const storedWelcomeTitle = String(formInstance.welcome_title ?? "").trim();
      const storedWelcomeMessage = String(
        formInstance.welcome_message ?? "",
      ).trim();
      const welcomeTitle =
        storedWelcomeTitle ||
        (isProjectBrief
          ? "Thank you for your trust"
          : isProjectResources
            ? "Share your project photos"
            : null);
      const welcomeMessage =
        storedWelcomeMessage ||
        (isProjectBrief
          ? agencyName
            ? `Thanks for choosing ${agencyName}. We’re excited to build your website with you. This short brief helps us get the details right — many answers are already filled in, and it only takes a few minutes.`
            : "Thanks for trusting us with your website. This short brief helps us get the details right — many answers are already filled in, and it only takes a few minutes."
          : isProjectResources
            ? agencyName
              ? `Thanks for working with ${agencyName}. Upload logos, team photos, and service photos so we can build your site with the right assets.`
              : "Upload logos, team photos, and service photos so we can build your site with the right assets."
            : null);

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
            logo_url: logoUrl,
            agency_name: agencyName,
            agency_phone: agencyPhone,
            agency_email: agencyEmail,
            agency_address: agencyAddress,
            agency_website: agencyWebsite,
            primary_color: formInstance.primary_color,
            background_image_url: backgroundImageUrl,
            welcome_title: welcomeTitle,
            welcome_message: welcomeMessage,
            thank_you_title: formInstance.thank_you_title,
            thank_you_message: formInstance.thank_you_message,
            recaptcha_enabled: formInstance.recaptcha_enabled,
            honeypot_enabled: formInstance.honeypot_enabled,
            custom_font_url: formInstance.custom_font_url,
            custom_css: formInstance.custom_css,
          },
          prefill,
          request_scope: tokenData.request_scope ?? null,
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
