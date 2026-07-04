import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { sendTransactionalEmail } from "../_shared/transactionalEmail.ts";
import { resolveOrgGeneralFrom } from "../_shared/organizationEmailSenders.ts";

type SendBody = {
  audit_id?: number;
  to?: string;
  subject?: string;
  message?: string;
  pdf_base64?: string;
  filename?: string;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve((req: Request) =>
  OptionsMiddleware(req, async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    return UserMiddleware(req, async (req, user) => {
      if (!user) {
        return createErrorResponse(401, "Unauthorized");
      }

      const member = await getUserOrganizationMember(user);
      const orgId = member?.org_id != null ? Number(member.org_id) : null;
      if (!orgId) {
        return createErrorResponse(403, "Organization not found");
      }

      try {
        const payload = (await req.json()) as SendBody;
        const auditId = Number(payload.audit_id);
        const to = payload.to?.trim() ?? "";
        const subject = payload.subject?.trim() ?? "";
        const message = payload.message?.trim() ?? "";
        const pdfBase64 = payload.pdf_base64?.trim() ?? "";
        const filename = payload.filename?.trim() || "web-report.pdf";

        if (!Number.isFinite(auditId)) {
          throw new Error("Invalid audit_id");
        }
        if (!emailRegex.test(to)) {
          throw new Error("Invalid recipient email");
        }
        if (!subject) {
          throw new Error("Subject is required");
        }
        if (!message) {
          throw new Error("Message is required");
        }
        if (!pdfBase64) {
          throw new Error("PDF attachment is required");
        }

        const { data: audit, error: auditError } = await supabaseAdmin
          .from("website_audits")
          .select("id, org_id, status, audit_url")
          .eq("id", auditId)
          .maybeSingle();

        if (auditError || !audit) {
          throw new Error("Report not found");
        }
        if (Number(audit.org_id) !== orgId) {
          return createErrorResponse(403, "Forbidden");
        }
        if (audit.status !== "done") {
          throw new Error("Only completed reports can be emailed");
        }

        const { data: org } = await supabaseAdmin
          .from("organizations")
          .select("name, email")
          .eq("id", orgId)
          .maybeSingle();

        const generalFrom = await resolveOrgGeneralFrom(
          orgId,
          org?.name ?? null,
        );

        await sendTransactionalEmail({
          orgId,
          orgName: org?.name ?? null,
          to,
          subject,
          textBody: message,
          fromEmail: generalFrom.email,
          fromName: generalFrom.name,
          replyTo: generalFrom.email,
          emailChannel: "general",
          attachments: [
            {
              name: filename,
              contentBase64: pdfBase64,
              contentType: "application/pdf",
            },
          ],
        });

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        console.error("website_audit_send", message);
        return createErrorResponse(400, message);
      }
    });
  }),
);
