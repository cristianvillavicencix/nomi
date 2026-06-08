import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { hasMemberCapability } from "../_shared/memberModulePermissions.ts";
import { markClientInvoiceSent } from "../_shared/clientInvoiceFlow.ts";
import {
  isOrgTransactionalEmailConfigured,
  sendTransactionalEmail,
} from "../_shared/transactionalEmail.ts";

type SendBody = {
  invoice_id?: number;
  to?: string;
  subject?: string;
  message?: string;
  pdf_base64?: string;
  filename?: string;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
          return createErrorResponse(403, "You cannot send invoices");
        }

        const body = (await req.json()) as SendBody;
        const invoiceId = Number(body.invoice_id);
        const to = String(body.to ?? "").trim().toLowerCase();
        const pdfBase64 = String(body.pdf_base64 ?? "").trim();

        if (!Number.isFinite(invoiceId) || !to || !emailRegex.test(to)) {
          return createErrorResponse(400, "Invalid invoice_id or recipient email");
        }

        if (!pdfBase64) {
          return createErrorResponse(400, "pdf_base64 is required");
        }

        const { data: invoice } = await supabaseAdmin
          .from("client_invoices")
          .select("id, invoice_number, amount, currency, description, org_id, status")
          .eq("id", invoiceId)
          .eq("org_id", member.org_id)
          .maybeSingle();

        if (!invoice) {
          return createErrorResponse(404, "Invoice not found");
        }

        if (invoice.status === "paid" || invoice.status === "void") {
          return createErrorResponse(
            400,
            "Paid or void invoices cannot be sent",
          );
        }

        const { data: org } = await supabaseAdmin
          .from("organizations")
          .select("name, email")
          .eq("id", member.org_id)
          .maybeSingle();

        const subject =
          body.subject?.trim() ||
          `Invoice ${invoice.invoice_number} from ${org?.name ?? "LBS"}`;
        const message =
          body.message?.trim() ||
          `Please find attached invoice ${invoice.invoice_number} for ${invoice.description} (${invoice.currency} ${invoice.amount}).\n\nThank you for your business.`;

        const filename =
          body.filename?.trim() || `${invoice.invoice_number}.pdf`;

        let emailSent = false;
        let emailSkipped = false;

        if (await isOrgTransactionalEmailConfigured(member.org_id)) {
          await sendTransactionalEmail({
            orgId: member.org_id,
            orgName: org?.name ?? null,
            to,
            subject,
            textBody: message,
            replyTo: org?.email?.trim() ?? null,
            attachments: [
              {
                name: filename,
                contentBase64: pdfBase64,
                contentType: "application/pdf",
              },
            ],
          });
          emailSent = true;
        } else {
          emailSkipped = true;
          console.warn(
            "send_client_invoice.email_skipped",
            "Transactional email is not configured; marking invoice sent without email",
          );
        }

        const updated = await markClientInvoiceSent(
          supabaseAdmin,
          invoiceId,
          member.org_id,
          to,
        );

        return new Response(
          JSON.stringify({
            invoice: updated,
            sent: true,
            email_sent: emailSent,
            email_skipped: emailSkipped,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      } catch (error) {
        console.error("send_client_invoice.error", error);
        return createErrorResponse(
          500,
          error instanceof Error ? error.message : "Unexpected error",
        );
      }
    });
  }),
);
