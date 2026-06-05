import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { hasMemberCapability } from "../_shared/memberModulePermissions.ts";
import { issueClientInvoiceFromInstallment, issueClientInvoiceFromProposal } from "../_shared/clientInvoiceFlow.ts";

type IssueBody = {
  installment_id?: number;
  proposal_id?: number;
  amount?: number;
  due_date?: string;
  description?: string;
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
          return createErrorResponse(403, "You cannot issue invoices");
        }

        const body = (await req.json()) as IssueBody;
        const installmentId = body.installment_id
          ? Number(body.installment_id)
          : undefined;
        const proposalId = body.proposal_id
          ? Number(body.proposal_id)
          : undefined;

        if (installmentId && Number.isFinite(installmentId)) {
          const invoice = await issueClientInvoiceFromInstallment(
            supabaseAdmin,
            member.org_id,
            installmentId,
          );
          return new Response(JSON.stringify({ invoice }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (proposalId && Number.isFinite(proposalId)) {
          const invoice = await issueClientInvoiceFromProposal(
            supabaseAdmin,
            member.org_id,
            {
              proposalId,
              amount:
                body.amount != null ? Number(body.amount) : undefined,
              dueDate: body.due_date,
              description: body.description,
            },
          );
          return new Response(JSON.stringify({ invoice }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return createErrorResponse(
          400,
          "Provide installment_id or proposal_id",
        );
      } catch (error) {
        console.error("issue_client_invoice.error", error);
        return createErrorResponse(
          500,
          error instanceof Error ? error.message : "Unexpected error",
        );
      }
    });
  }),
);
