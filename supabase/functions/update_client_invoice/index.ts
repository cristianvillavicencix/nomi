import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { hasMemberCapability } from "../_shared/memberModulePermissions.ts";
import {
  updateStandaloneClientInvoice,
  type UpdateStandaloneInvoiceInput,
} from "../_shared/clientInvoiceFlow.ts";

type UpdateBody = UpdateStandaloneInvoiceInput & {
  invoice_id?: number;
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
          return createErrorResponse(403, "You cannot edit invoices");
        }

        const body = (await req.json()) as UpdateBody;
        const invoiceId = Number(body.invoice_id);
        if (!Number.isFinite(invoiceId)) {
          return createErrorResponse(400, "Invalid invoice_id");
        }
        if (!body.due_date?.trim()) {
          return createErrorResponse(400, "due_date is required");
        }

        const { invoice_id: _ignored, ...input } = body;
        const invoice = await updateStandaloneClientInvoice(
          supabaseAdmin,
          member.org_id,
          invoiceId,
          input,
        );

        return new Response(JSON.stringify({ invoice }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("update_client_invoice.error", error);
        return createErrorResponse(
          500,
          error instanceof Error ? error.message : "Unexpected error",
        );
      }
    });
  }),
);
