import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { findContactByPhone } from "../_shared/messagingConversations.ts";
import { normalizeUsPhoneToE164 } from "../_shared/phone.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

type LookupBody = {
  phone?: string;
};

Deno.serve((req: Request) =>
  OptionsMiddleware(req, async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    return UserMiddleware(req, async (_req, user) => {
      if (!user) {
        return createErrorResponse(401, "Unauthorized");
      }

      try {
        const member = await getUserOrganizationMember(user);
        const orgId = member?.org_id != null ? Number(member.org_id) : null;
        if (!orgId) {
          return createErrorResponse(403, "Organization not found");
        }

        const payload = (await req.json()) as LookupBody;
        const normalized = normalizeUsPhoneToE164(payload.phone?.trim() ?? "");
        if (!normalized) {
          return createErrorResponse(400, "A valid phone number is required");
        }

        const contact = await findContactByPhone(orgId, normalized);
        if (!contact?.id) {
          return new Response(JSON.stringify({ contact: null }), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        let companyName: string | null = null;
        if (contact.company_id != null) {
          const { data: company } = await supabaseAdmin
            .from("companies")
            .select("name")
            .eq("id", contact.company_id)
            .eq("org_id", orgId)
            .maybeSingle();
          companyName =
            typeof company?.name === "string" ? company.name.trim() : null;
        }

        const firstName =
          typeof contact.first_name === "string" ? contact.first_name.trim() : "";
        const lastName =
          typeof contact.last_name === "string" ? contact.last_name.trim() : "";
        const fullName = `${firstName} ${lastName}`.trim();

        return new Response(
          JSON.stringify({
            contact: {
              id: contact.id,
              first_name: firstName || null,
              last_name: lastName || null,
              full_name: fullName || null,
              company_id: contact.company_id ?? null,
              company_name: companyName,
            },
          }),
          {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Contact lookup failed";
        return createErrorResponse(400, message);
      }
    });
  }),
);
