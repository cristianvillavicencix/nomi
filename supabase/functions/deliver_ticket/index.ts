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

        if (!ticket?.id) {
          return createErrorResponse(404, "Ticket not found");
        }

        let invoiceId = ticket.invoice_id ? Number(ticket.invoice_id) : null;

        if (!invoiceId) {
          const { data: deliverableLink } = await supabaseAdmin
            .from("ticket_deliverables")
            .select("invoiced_invoice_id")
            .eq("ticket_id", ticket.id)
            .eq("org_id", member.org_id)
            .not("invoiced_invoice_id", "is", null)
            .is("delivered_at", null)
            .order("id", { ascending: false })
            .limit(1)
            .maybeSingle();

          invoiceId = deliverableLink?.invoiced_invoice_id
            ? Number(deliverableLink.invoiced_invoice_id)
            : null;
        }

        if (!invoiceId) {
          return createErrorResponse(
            400,
            "This ticket has no paid invoice with files ready to deliver",
          );
        }

        const { data: invoice } = await supabaseAdmin
          .from("client_invoices")
          .select("id, status")
          .eq("id", invoiceId)
          .eq("org_id", member.org_id)
          .maybeSingle();

        if (!invoice || invoice.status !== "paid") {
          return createErrorResponse(
            400,
            "Invoice must be paid before delivering files",
          );
        }

        const result = await deliverTicketAfterInvoicePayment(supabaseAdmin, {
          invoiceId,
          orgId: member.org_id,
        });

        if (!result.delivered && !result.duplicate) {
          const reason = String(result.reason ?? "");
          const reasonMessage =
            reason === "no_deliverables"
              ? "No undelivered files found for this invoice"
              : reason === "missing_recipient"
                ? "Add a requester email on the ticket before delivering"
                : reason === "missing_inbox" || reason === "inbox_paused"
                  ? "Ticket inbox is missing or paused. Check Settings → Tickets."
                  : reason === "ticket_missing_or_merged"
                    ? "Ticket was merged or no longer available"
                    : reason || "Could not deliver files";
          return createErrorResponse(400, reasonMessage);
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
