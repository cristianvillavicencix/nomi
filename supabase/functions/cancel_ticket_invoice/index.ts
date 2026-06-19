import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { hasMemberCapability } from "../_shared/memberModulePermissions.ts";
import { cancelTicketInvoiceDraft } from "../_shared/ticketInvoiceFlow.ts";

type CancelBody = {
  ticket_id?: number;
};

Deno.serve(
  OptionsMiddleware(async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    return UserMiddleware(req, async (req, user) => {
      if (!user) {
        return createErrorResponse(401, "Unauthorized");
      }

      try {
        const member = await getUserOrganizationMember(user);
        if (!member?.id) {
          return createErrorResponse(401, "Unauthorized");
        }

        if (
          !member.administrator &&
          !hasMemberCapability(member, "support.tickets.manage")
        ) {
          return createErrorResponse(403, "You cannot manage ticket invoices");
        }

        const body = (await req.json()) as CancelBody;
        const ticketId = Number(body.ticket_id);
        if (!Number.isFinite(ticketId)) {
          return createErrorResponse(400, "Invalid ticket_id");
        }

        const result = await cancelTicketInvoiceDraft(supabaseAdmin, {
          orgId: member.org_id,
          ticketId,
        });

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("cancel_ticket_invoice.error", error);
        return createErrorResponse(
          500,
          error instanceof Error ? error.message : "Unexpected error",
        );
      }
    });
  }),
);
