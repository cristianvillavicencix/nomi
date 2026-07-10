import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { getHostingerApiToken } from "../_shared/hostingerSettings.ts";
import {
  checkHostingerAvailability,
  enrichAvailabilityWithCatalog,
} from "../_shared/hostingerApi.ts";
import { getHostingerSettingsPublic } from "../_shared/hostingerSettings.ts";

type AvailabilityBody = {
  domain?: string;
  tlds?: string[];
  with_alternatives?: boolean;
};

const DEFAULT_TLDS = ["com", "net", "org", "io", "co"];

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
      if (!orgId) {
        return createErrorResponse(403, "Organization not found");
      }

      try {
        const body = (await req.json().catch(() => ({}))) as AvailabilityBody;
        const label = body.domain?.trim().toLowerCase() ?? "";
        if (!label) {
          return createErrorResponse(400, "Domain label is required");
        }

        const apiToken = await getHostingerApiToken(orgId);
        if (!apiToken) {
          throw new Error("Hostinger API token is not configured");
        }

        const tlds = (body.tlds?.length ? body.tlds : DEFAULT_TLDS).map((tld) =>
          tld.replace(/^\./, "").trim().toLowerCase()
        ).filter(Boolean);

        // Hostinger API: alternatives only work with a single TLD in the request.
        const withAlternatives = tlds.length === 1 &&
          (body.with_alternatives ?? true);

        const results = await checkHostingerAvailability(apiToken, {
          domain: label,
          tlds,
          withAlternatives,
        });

        const enriched = await enrichAvailabilityWithCatalog(apiToken, results);
        const settings = await getHostingerSettingsPublic(orgId);

        return new Response(
          JSON.stringify({
            ok: true,
            results: enriched,
            referral_code: settings.referral_code,
            referral_link_template: settings.referral_link_template,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : "Hostinger availability check failed";
        return createErrorResponse(400, message);
      }
    });
  }),
);
