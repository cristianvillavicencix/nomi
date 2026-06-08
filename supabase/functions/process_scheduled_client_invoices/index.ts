import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { isAuthorizedClientBillingCron } from "../_shared/clientProposalBilling.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { markClientInvoiceSent } from "../_shared/clientInvoiceFlow.ts";
import {
  isOrgTransactionalEmailConfigured,
  sendTransactionalEmail,
} from "../_shared/transactionalEmail.ts";

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

Deno.serve(
  OptionsMiddleware(async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    if (!isAuthorizedClientBillingCron(req)) {
      return createErrorResponse(401, "Unauthorized");
    }

    try {
      const now = new Date().toISOString();
      const { data: dueRows, error: listError } = await supabaseAdmin
        .from("client_invoices")
        .select(
          "id, org_id, invoice_number, amount, currency, description, recipient_email, scheduled_send_at, scheduled_send_message, scheduled_send_storage_path",
        )
        .eq("status", "draft")
        .not("scheduled_send_at", "is", null)
        .lte("scheduled_send_at", now)
        .limit(25);

      if (listError) {
        throw new Error(listError.message);
      }

      const results: Array<{ invoice_id: number; ok: boolean; error?: string }> =
        [];

      for (const row of dueRows ?? []) {
        try {
          if (!(await isOrgTransactionalEmailConfigured(row.org_id))) {
            results.push({
              invoice_id: row.id,
              ok: false,
              error: "Twilio is not configured for this organization",
            });
            continue;
          }

          const to = row.recipient_email?.trim();
          const storagePath = row.scheduled_send_storage_path?.trim();
          if (!to || !storagePath) {
            results.push({
              invoice_id: row.id,
              ok: false,
              error: "Missing recipient or PDF",
            });
            continue;
          }

          const { data: file, error: downloadError } = await supabaseAdmin.storage
            .from("attachments")
            .download(storagePath);

          if (downloadError || !file) {
            results.push({
              invoice_id: row.id,
              ok: false,
              error: downloadError?.message ?? "PDF not found",
            });
            continue;
          }

          const pdfBase64 = bytesToBase64(new Uint8Array(await file.arrayBuffer()));

          const { data: org } = await supabaseAdmin
            .from("organizations")
            .select("name, email")
            .eq("id", row.org_id)
            .maybeSingle();

          const subject = `Invoice ${row.invoice_number} from ${org?.name ?? "LBS"}`;
          const message =
            row.scheduled_send_message?.trim() ||
            `Please find attached invoice ${row.invoice_number} for ${row.description} (${row.currency} ${row.amount}).\n\nThank you for your business.`;

          await sendTransactionalEmail({
            orgId: row.org_id,
            orgName: org?.name ?? null,
            to,
            subject,
            textBody: message,
            replyTo: org?.email?.trim() ?? null,
            attachments: [
              {
                name: `${row.invoice_number}.pdf`,
                contentBase64: pdfBase64,
                contentType: "application/pdf",
              },
            ],
          });

          await markClientInvoiceSent(supabaseAdmin, row.id, row.org_id, to);

          await supabaseAdmin
            .from("client_invoices")
            .update({
              scheduled_send_at: null,
              scheduled_send_message: null,
              scheduled_send_storage_path: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id)
            .eq("org_id", row.org_id);

          await supabaseAdmin.storage.from("attachments").remove([storagePath]);

          results.push({ invoice_id: row.id, ok: true });
        } catch (error) {
          results.push({
            invoice_id: row.id,
            ok: false,
            error: error instanceof Error ? error.message : "Send failed",
          });
        }
      }

      return new Response(
        JSON.stringify({
          processed: results.length,
          sent: results.filter((entry) => entry.ok).length,
          failed: results.filter((entry) => !entry.ok).length,
          results,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (error) {
      console.error("process_scheduled_client_invoices.error", error);
      return createErrorResponse(
        500,
        error instanceof Error ? error.message : "Unexpected error",
      );
    }
  }),
);
