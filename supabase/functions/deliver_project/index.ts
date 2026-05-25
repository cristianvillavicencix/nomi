import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { hasMemberCapability } from "../_shared/memberModulePermissions.ts";

type DeliverProjectBody = {
  deal_id?: number;
  site_url?: string;
  plan_name?: string;
  project_start_date?: string | null;
  delivery_date?: string;
  hosting_renewal_date?: string | null;
  hosting_status?: string;
  site_language?: string | null;
  included_pages?: string[];
  maintenance_plan?: Record<string, unknown>;
  enabled_sections?: string[];
  checklist_snapshot?: Record<string, unknown>;
  notify_email?: boolean;
  notify_whatsapp?: boolean;
  notify_portal?: boolean;
  share_credential_entry_ids?: number[];
  domain?: {
    domain?: string;
    registrar?: string | null;
    registered_at?: string | null;
    renewal_date?: string | null;
    managed_by?: "lbs" | "client";
    auto_renew?: boolean;
    dns_servers?: string[];
  };
  corporate_emails?: Array<{
    email?: string;
    config_notes?: string | null;
  }>;
};

const DEFAULT_WEBSITE_SECTIONS = [
  "general",
  "credentials",
  "corporate_email",
  "domain_dns",
  "files",
  "marketing_seo",
  "onboarding",
  "support",
];

const parseDomainFromUrl = (siteUrl?: string | null) => {
  if (!siteUrl?.trim()) return "";
  try {
    const href = siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`;
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return siteUrl
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0];
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

      try {
        const body = (await req.json()) as DeliverProjectBody;
        const dealId = Number(body.deal_id);
        if (!Number.isFinite(dealId)) {
          return createErrorResponse(400, "Missing deal_id");
        }

        const member = await getUserOrganizationMember(user);
        if (!member?.id || !member.org_id) {
          return createErrorResponse(403, "Organization membership required");
        }
        if (!hasMemberCapability(member, "crm.pipeline.edit")) {
          return createErrorResponse(403, "Not allowed to deliver projects");
        }

        const { data: deal, error: dealError } = await supabaseAdmin
          .from("deals")
          .select(
            "id, org_id, name, stage, delivery_status, production_url, created_at, website_brief",
          )
          .eq("id", dealId)
          .eq("org_id", member.org_id)
          .maybeSingle();

        if (dealError || !deal) {
          return createErrorResponse(404, "Project not found");
        }

        const { data: existingDelivery } = await supabaseAdmin
          .from("project_deliveries")
          .select("id")
          .eq("deal_id", dealId)
          .is("revoked_at", null)
          .maybeSingle();

        if (existingDelivery?.id) {
          return createErrorResponse(
            409,
            "This project was already delivered. Revoke the current delivery first.",
          );
        }

        const brief =
          deal.website_brief && typeof deal.website_brief === "object"
            ? (deal.website_brief as Record<string, unknown>)
            : {};

        const siteUrl =
          body.site_url?.trim() ||
          String(deal.production_url ?? "").trim() ||
          null;
        const deliveryDate =
          body.delivery_date?.trim() || new Date().toISOString().slice(0, 10);

        const deliveryRow = {
          org_id: member.org_id,
          deal_id: dealId,
          delivered_by_member_id: member.id,
          site_url: siteUrl,
          plan_name: body.plan_name?.trim() || null,
          project_start_date:
            body.project_start_date?.trim() ||
            (deal.created_at
              ? String(deal.created_at).slice(0, 10)
              : null),
          delivery_date: deliveryDate,
          hosting_renewal_date: body.hosting_renewal_date?.trim() || null,
          hosting_status: body.hosting_status?.trim() || "active",
          site_language:
            body.site_language?.trim() ||
            String(brief.site_language ?? "").trim() ||
            null,
          included_pages: body.included_pages ?? [],
          maintenance_plan: body.maintenance_plan ?? {},
          enabled_sections: body.enabled_sections?.length
            ? body.enabled_sections
            : DEFAULT_WEBSITE_SECTIONS,
          checklist_snapshot: body.checklist_snapshot ?? {},
          notify_email: body.notify_email ?? true,
          notify_whatsapp: body.notify_whatsapp ?? false,
          notify_portal: body.notify_portal ?? true,
        };

        const { data: delivery, error: deliveryError } = await supabaseAdmin
          .from("project_deliveries")
          .insert(deliveryRow)
          .select("id, delivered_at, site_url, delivery_date")
          .single();

        if (deliveryError || !delivery) {
          throw new Error(deliveryError?.message ?? "Failed to create delivery");
        }

        await supabaseAdmin
          .from("deals")
          .update({
            delivery_status: "launched",
            stage: "launch",
            production_url: siteUrl ?? deal.production_url,
          })
          .eq("id", dealId);

        const shareIds = (body.share_credential_entry_ids ?? []).filter(
          (id) => Number.isFinite(Number(id)),
        );
        if (shareIds.length > 0) {
          await supabaseAdmin
            .from("deal_access_entries")
            .update({ shared_with_client: true })
            .eq("deal_id", dealId)
            .eq("org_id", member.org_id)
            .in("id", shareIds);
        }

        const domainInput = body.domain ?? {};
        const domainName =
          domainInput.domain?.trim() ||
          parseDomainFromUrl(siteUrl) ||
          null;
        if (domainName) {
          await supabaseAdmin.from("project_delivery_domains").insert({
            org_id: member.org_id,
            delivery_id: delivery.id,
            deal_id: dealId,
            domain: domainName,
            registrar: domainInput.registrar?.trim() || null,
            registered_at: domainInput.registered_at?.trim() || null,
            renewal_date: domainInput.renewal_date?.trim() || null,
            managed_by: domainInput.managed_by === "client" ? "client" : "lbs",
            auto_renew: domainInput.auto_renew ?? true,
            dns_servers: domainInput.dns_servers ?? [],
          });
        }

        const corporateEmails = (body.corporate_emails ?? [])
          .map((entry) => ({
            email: entry.email?.trim() ?? "",
            config_notes: entry.config_notes?.trim() || null,
          }))
          .filter((entry) => entry.email.length > 0);

        if (corporateEmails.length > 0) {
          await supabaseAdmin.from("project_delivery_corporate_emails").insert(
            corporateEmails.map((entry) => ({
              org_id: member.org_id,
              delivery_id: delivery.id,
              deal_id: dealId,
              email: entry.email,
              config_notes: entry.config_notes,
              has_password: false,
            })),
          );
        }

        await supabaseAdmin.from("project_delivery_log").insert({
          org_id: member.org_id,
          deal_id: dealId,
          delivery_id: delivery.id,
          action: "delivered",
          actor_member_id: member.id,
          metadata: {
            site_url: siteUrl,
            notify_email: deliveryRow.notify_email,
            notify_portal: deliveryRow.notify_portal,
          },
        });

        if (deliveryRow.notify_portal) {
          const { data: accessRows = [] } = await supabaseAdmin
            .from("client_portal_deal_access")
            .select("portal_account_id")
            .eq("deal_id", dealId)
            .eq("org_id", member.org_id);

          const notifications = accessRows
            .map((row) => row.portal_account_id)
            .filter(Boolean)
            .map((portalAccountId) => ({
              org_id: member.org_id,
              portal_account_id: portalAccountId,
              deal_id: dealId,
              delivery_id: delivery.id,
              notification_type: "delivery_ready",
              title: "¡Tu sitio web está listo!",
              body: siteUrl
                ? `Tu proyecto está en vivo: ${siteUrl}`
                : "Tu proyecto fue entregado. Revisa la sección Mi Sitio Web.",
            }));

          if (notifications.length > 0) {
            await supabaseAdmin
              .from("project_delivery_notifications")
              .insert(notifications);
          }
        }

        return new Response(
          JSON.stringify({
            ok: true,
            delivery,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } catch (error) {
        console.error("deliver_project.error", error);
        return createErrorResponse(
          500,
          error instanceof Error ? error.message : "Unexpected error",
        );
      }
    });
  }),
);
