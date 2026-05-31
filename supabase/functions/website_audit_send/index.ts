import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

type SendBody = {
  audit_id?: number;
  to?: string;
  subject?: string;
  message?: string;
  pdf_base64?: string;
  filename?: string;
};

const getPostmarkServerToken = () =>
  Deno.env.get("POSTMARK_SERVER_TOKEN")?.trim();
const getPostmarkFromEmail = () => Deno.env.get("POSTMARK_FROM_EMAIL")?.trim();

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const sendReportEmail = async (params: {
  to: string;
  subject: string;
  message: string;
  pdfBase64: string;
  filename: string;
}) => {
  const token = getPostmarkServerToken();
  const from = getPostmarkFromEmail();
  if (!token || !from) {
    throw new Error(
      "El envío por correo no está configurado (POSTMARK_SERVER_TOKEN / POSTMARK_FROM_EMAIL).",
    );
  }

  const htmlBody = params.message
    .split("\n")
    .map((line) => `<p>${line.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`)
    .join("");

  const res = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": token,
    },
    body: JSON.stringify({
      From: from,
      To: params.to,
      Subject: params.subject,
      TextBody: params.message,
      HtmlBody: htmlBody,
      Attachments: [
        {
          Name: params.filename,
          Content: params.pdfBase64,
          ContentType: "application/pdf",
          ContentID: null,
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`No se pudo enviar el correo (${res.status}) ${text}`);
  }
};

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
        const filename = payload.filename?.trim() || "reporte-web.pdf";

        if (!Number.isFinite(auditId)) {
          throw new Error("audit_id inválido");
        }
        if (!emailRegex.test(to)) {
          throw new Error("Correo del cliente inválido");
        }
        if (!subject) {
          throw new Error("El asunto es obligatorio");
        }
        if (!message) {
          throw new Error("El mensaje es obligatorio");
        }
        if (!pdfBase64) {
          throw new Error("Falta el PDF adjunto");
        }

        const { data: audit, error: auditError } = await supabaseAdmin
          .from("website_audits")
          .select("id, org_id, status, audit_url")
          .eq("id", auditId)
          .maybeSingle();

        if (auditError || !audit) {
          throw new Error("Reporte no encontrado");
        }
        if (Number(audit.org_id) !== orgId) {
          return createErrorResponse(403, "Forbidden");
        }
        if (audit.status !== "done") {
          throw new Error("Solo se pueden enviar reportes completados");
        }

        await sendReportEmail({
          to,
          subject,
          message,
          pdfBase64,
          filename,
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
