import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { hasMemberCapability } from "../_shared/memberModulePermissions.ts";

type ScheduleBody = {
  invoice_id?: number;
  to?: string;
  message?: string;
  scheduled_send_at?: string;
  pdf_base64?: string;
  filename?: string;
  sms_to?: string;
  sms_body?: string;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const decodeBase64 = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
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
          return createErrorResponse(403, "You cannot schedule invoices");
        }

        const body = (await req.json()) as ScheduleBody;
        const invoiceId = Number(body.invoice_id);
        const to = String(body.to ?? "").trim().toLowerCase();
        const pdfBase64 = String(body.pdf_base64 ?? "").trim();
        const scheduledSendAt = String(body.scheduled_send_at ?? "").trim();
        const message = body.message?.trim() || null;
        const smsTo = String(body.sms_to ?? "").trim();
        const smsBody = body.sms_body?.trim() || null;

        if (smsTo && !smsBody) {
          return createErrorResponse(400, "sms_body is required when sms_to is set");
        }

        if (!Number.isFinite(invoiceId) || !to || !emailRegex.test(to)) {
          return createErrorResponse(400, "Invalid invoice_id or recipient email");
        }

        if (!pdfBase64) {
          return createErrorResponse(400, "pdf_base64 is required");
        }

        const sendAt = new Date(scheduledSendAt);
        if (!scheduledSendAt || Number.isNaN(sendAt.getTime())) {
          return createErrorResponse(400, "Invalid scheduled_send_at");
        }

        if (sendAt.getTime() <= Date.now()) {
          return createErrorResponse(
            400,
            "Scheduled send must be in the future",
          );
        }

        const { data: invoice } = await supabaseAdmin
          .from("client_invoices")
          .select("id, invoice_number, status, org_id")
          .eq("id", invoiceId)
          .eq("org_id", member.org_id)
          .maybeSingle();

        if (!invoice?.id) {
          return createErrorResponse(404, "Invoice not found");
        }

        if (invoice.status === "void" || invoice.status === "paid") {
          return createErrorResponse(400, "This invoice cannot be scheduled");
        }

        const filename =
          body.filename?.trim() || `${invoice.invoice_number}.pdf`;
        const storagePath =
          `invoice-scheduled/${member.org_id}/${invoiceId}/${Date.now()}-${filename}`;

        const { error: uploadError } = await supabaseAdmin.storage
          .from("attachments")
          .upload(storagePath, decodeBase64(pdfBase64), {
            contentType: "application/pdf",
            upsert: true,
          });

        if (uploadError) {
          console.error("schedule_client_invoice.upload_error", uploadError);
          return createErrorResponse(500, "Could not store invoice PDF");
        }

        const now = new Date().toISOString();
        const { data: updated, error: updateError } = await supabaseAdmin
          .from("client_invoices")
          .update({
            recipient_email: to,
            scheduled_send_at: sendAt.toISOString(),
            scheduled_send_message: message,
            scheduled_send_storage_path: storagePath,
            scheduled_send_sms_to: smsTo || null,
            scheduled_send_sms_body: smsBody,
            updated_at: now,
          })
          .eq("id", invoiceId)
          .eq("org_id", member.org_id)
          .select("*")
          .single();

        if (updateError || !updated) {
          await supabaseAdmin.storage.from("attachments").remove([storagePath]);
          return createErrorResponse(500, "Could not schedule invoice send");
        }

        return new Response(
          JSON.stringify({ invoice: updated, scheduled: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } catch (error) {
        console.error("schedule_client_invoice.error", error);
        return createErrorResponse(
          500,
          error instanceof Error ? error.message : "Unexpected error",
        );
      }
    });
  }),
);
