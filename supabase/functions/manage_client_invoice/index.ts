import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { hasMemberCapability } from "../_shared/memberModulePermissions.ts";
import {
  deleteStandaloneClientInvoice,
  markClientInvoiceSentManual,
  voidClientInvoice,
} from "../_shared/clientInvoiceFlow.ts";

type ManageBody = {
  invoice_id?: number;
  action?: "mark_sent" | "void" | "delete";
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
          !hasMemberCapability(member, "proposals.send")
        ) {
          return createErrorResponse(403, "You cannot manage invoices");
        }

        const body = (await req.json()) as ManageBody;
        const invoiceId = Number(body.invoice_id);
        const action = body.action;

        if (!Number.isFinite(invoiceId) || !action) {
          return createErrorResponse(400, "Invalid invoice_id or action");
        }

        if (action === "mark_sent") {
          const invoice = await markClientInvoiceSentManual(
            supabaseAdmin,
            invoiceId,
            member.org_id,
          );
          return new Response(JSON.stringify({ invoice }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (action === "void") {
          const invoice = await voidClientInvoice(
            supabaseAdmin,
            invoiceId,
            member.org_id,
          );
          return new Response(JSON.stringify({ invoice }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (action === "delete") {
          const result = await deleteStandaloneClientInvoice(
            supabaseAdmin,
            invoiceId,
            member.org_id,
          );
          return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return createErrorResponse(400, "Unknown action");
      } catch (error) {
        console.error("manage_client_invoice.error", error);
        return createErrorResponse(
          500,
          error instanceof Error ? error.message : "Unexpected error",
        );
      }
    });
  }),
);
