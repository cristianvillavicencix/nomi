import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { hasMemberCapability } from "../_shared/memberModulePermissions.ts";
import { sendCombinedTicketInvoicePaymentLink } from "../_shared/combinedTicketInvoiceFlow.ts";

type SendBody = {
  ticket_ids?: number[];
  base_url?: string;
  message?: string;
  subject?: string;
  sms_to?: string;
  send_sms?: boolean;
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
          return createErrorResponse(403, "You cannot invoice tickets");
        }

        if (
          !member.administrator &&
          !hasMemberCapability(member, "proposals.send")
        ) {
          return createErrorResponse(403, "You cannot send invoices");
        }

        const body = (await req.json()) as SendBody;
        const ticketIds = (body.ticket_ids ?? [])
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id));

        if (ticketIds.length < 2) {
          return createErrorResponse(400, "Select at least two tickets");
        }

        const result = await sendCombinedTicketInvoicePaymentLink(supabaseAdmin, {
          orgId: member.org_id,
          memberId: member.id,
          ticketIds,
          baseUrl: body.base_url,
          message: body.message,
          subject: body.subject,
          smsTo: body.sms_to,
          sendSms: body.send_sms === true,
        });

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("send_combined_ticket_invoice.error", error);
        return createErrorResponse(
          500,
          error instanceof Error ? error.message : "Unexpected error",
        );
      }
    });
  }),
);
