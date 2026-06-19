import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { hasMemberCapability } from "../_shared/memberModulePermissions.ts";
import { deliverTicketAfterInvoicePayment } from "../_shared/ticketDelivery.ts";

type DeliverBody = {
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
          return createErrorResponse(403, "You cannot deliver ticket files");
        }

        const body = (await req.json()) as DeliverBody;
        const ticketId = Number(body.ticket_id);
        if (!Number.isFinite(ticketId)) {
          return createErrorResponse(400, "Invalid ticket_id");
        }

        const { data: ticket } = await supabaseAdmin
          .from("tickets")
          .select("id, org_id, invoice_id, delivery_status")
          .eq("id", ticketId)
          .eq("org_id", member.org_id)
          .maybeSingle();

        if (!ticket?.invoice_id) {
          return createErrorResponse(
            400,
            "This ticket has no invoice linked for delivery",
          );
        }

        const result = await deliverTicketAfterInvoicePayment(supabaseAdmin, {
          invoiceId: Number(ticket.invoice_id),
          orgId: member.org_id,
        });

        if (!result.delivered && !result.duplicate) {
          return createErrorResponse(
            400,
            result.reason ?? "Could not deliver files",
          );
        }

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("deliver_ticket.error", error);
        return createErrorResponse(
          500,
          error instanceof Error ? error.message : "Unexpected error",
        );
      }
    });
  }),
);
