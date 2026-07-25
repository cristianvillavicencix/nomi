import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import {
  getLbsDefaultMemberId,
  getLbsOrgId,
  verifyLbsIngestSecret,
} from "../_shared/lbsLeadIngestAuth.ts";
import {
  ingestLbsLead,
  type LbsLeadPayload,
} from "../_shared/lbsLeadIngest.ts";

Deno.serve(
  OptionsMiddleware(async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    const authError = verifyLbsIngestSecret(req);
    if (authError) return authError;

    const orgId = getLbsOrgId();
    if (!orgId) {
      return createErrorResponse(
        503,
        "LBS_ORG_ID is not configured on the server",
      );
    }

    let payload: LbsLeadPayload;
    try {
      payload = (await req.json()) as LbsLeadPayload;
    } catch {
      return createErrorResponse(400, "Invalid JSON body");
    }

    try {
      const result = await ingestLbsLead(supabaseAdmin, {
        orgId,
        payload,
        organizationMemberId: getLbsDefaultMemberId(),
      });

      return new Response(
        JSON.stringify({
          ok: true,
          contactId: result.contactId,
          companyId: result.companyId,
          dealId: result.dealId,
          createdContact: result.createdContact,
          createdCompany: result.createdCompany,
          createdDeal: result.createdDeal,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to ingest LBS lead";
      console.error("ingest_lbs_lead", message, error);

      if (
        message.includes("required") ||
        message.includes("Invalid or missing source")
      ) {
        return createErrorResponse(400, message);
      }

      return createErrorResponse(500, message);
    }
  }),
);
