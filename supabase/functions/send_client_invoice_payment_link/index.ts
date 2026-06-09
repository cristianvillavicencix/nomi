import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { hasMemberCapability } from "../_shared/memberModulePermissions.ts";
import { generateSecureToken } from "../_shared/formV2Schema.ts";
import { generateUniqueShortCode } from "../_shared/formTokenUtils.ts";
import {
  isOrgTransactionalEmailConfigured,
  sendTransactionalEmail,
} from "../_shared/transactionalEmail.ts";
import { resolveContactEmail } from "../_shared/clientProposalBilling.ts";
import { INVOICE_ORGANIZATION_NAME } from "../_shared/invoiceOrganizationInfo.ts";

type SendLinkBody = {
  invoice_id?: number;
  to?: string;
  base_url?: string;
  message?: string;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const resolveBaseUrl = (requested?: string) => {
  const trimmed = requested?.trim();
  if (trimmed) return trimmed.replace(/\/$/, "");
  const envUrl =
    Deno.env.get("PUBLIC_APP_URL")?.trim() ||
    Deno.env.get("VITE_PUBLIC_APP_URL")?.trim();
  return envUrl?.replace(/\/$/, "") ?? "https://lbs.bz";
};

const ensureShareLink = async (
  invoiceId: number,
  orgId: number,
  baseUrl: string,
) => {
  const { data: existing } = await supabaseAdmin
    .from("public_client_invoice_tokens")
    .select("token, short_code, expires_at")
    .eq("invoice_id", invoiceId)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.token) {
    const expired =
      existing.expires_at &&
      new Date(existing.expires_at).getTime() < Date.now();
    if (!expired) {
      const url = existing.short_code
        ? `${baseUrl}/iv/${existing.short_code}?pay=1`
        : `${baseUrl}/portal/invoice/${existing.token}?pay=1`;
      return { token: existing.token, url };
    }
  }

  const token = generateSecureToken();
  const shortCode = await generateUniqueShortCode(async (code) => {
    const { data: hit } = await supabaseAdmin
      .from("public_client_invoice_tokens")
      .select("id")
      .eq("short_code", code)
      .maybeSingle();
    return Boolean(hit?.id);
  });
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabaseAdmin.from("public_client_invoice_tokens").insert({
    org_id: orgId,
    invoice_id: invoiceId,
    token,
    short_code: shortCode,
    expires_at: expiresAt,
  });
  if (error) {
    throw new Error(error.message);
  }

  return {
    token,
    url: `${baseUrl}/iv/${shortCode}?pay=1`,
  };
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
          return createErrorResponse(403, "You cannot send payment links");
        }

        const body = (await req.json()) as SendLinkBody;
        const invoiceId = Number(body.invoice_id);
        if (!Number.isFinite(invoiceId)) {
          return createErrorResponse(400, "Invalid invoice_id");
        }

        const { data: invoice } = await supabaseAdmin
          .from("client_invoices")
          .select(
            "id, org_id, invoice_number, amount, amount_paid, currency, status, contact_id, recipient_email",
          )
          .eq("id", invoiceId)
          .eq("org_id", member.org_id)
          .maybeSingle();

        if (!invoice?.id) {
          return createErrorResponse(404, "Invoice not found");
        }

        if (invoice.status === "void" || invoice.status === "paid") {
          return createErrorResponse(
            409,
            "This invoice is already paid or void",
          );
        }

        const to =
          String(body.to ?? "").trim().toLowerCase() ||
          (await resolveContactEmail(supabaseAdmin, invoice.contact_id))?.trim()
            ?.toLowerCase() ||
          invoice.recipient_email?.trim().toLowerCase() ||
          "";

        if (!to || !emailRegex.test(to)) {
          return createErrorResponse(
            400,
            "No recipient email is on file for this invoice",
          );
        }

        if (!(await isOrgTransactionalEmailConfigured(member.org_id))) {
          return createErrorResponse(
            400,
            "Email is not configured for your organization",
          );
        }

        const baseUrl = resolveBaseUrl(body.base_url);
        const { url } = await ensureShareLink(invoiceId, member.org_id, baseUrl);

        const total = Number(invoice.amount) || 0;
        const paid = Number(invoice.amount_paid) || 0;
        const balance = Math.max(Math.round((total - paid) * 100) / 100, 0);
        const currency = invoice.currency ?? "USD";
        const balanceFormatted = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency,
        }).format(balance);

        const { data: org } = await supabaseAdmin
          .from("organizations")
          .select("name")
          .eq("id", member.org_id)
          .maybeSingle();

        const orgName = org?.name?.trim() || INVOICE_ORGANIZATION_NAME;
        const customMessage = body.message?.trim();
        const subject = `${orgName}: Pay invoice ${invoice.invoice_number}`;
        const textBody = [
          customMessage ||
            "Please use the secure link below to pay your invoice. Your card details are entered on a PCI-compliant page — we never see or store your full card number in email.",
          "",
          `Invoice: ${invoice.invoice_number}`,
          `Balance due: ${balanceFormatted}`,
          "",
          `Pay securely: ${url}`,
          "",
          orgName,
        ].join("\n");

        const htmlBody = `
          <div style="font-family:system-ui,sans-serif;color:#0f172a;line-height:1.5;max-width:560px;">
            <p>${customMessage ? customMessage.replace(/\n/g, "<br>") : "Please use the button below to pay your invoice on our secure payment page. Card details are handled by Stripe — never shared over email."}</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
              <tr><td style="padding:4px 0;color:#64748b;">Invoice</td><td style="padding:4px 0;text-align:right;font-weight:600;">${invoice.invoice_number}</td></tr>
              <tr><td style="padding:4px 0;color:#64748b;">Balance due</td><td style="padding:4px 0;text-align:right;font-weight:600;">${balanceFormatted}</td></tr>
            </table>
            <p style="margin:20px 0;"><a href="${url}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Pay securely</a></p>
            <p style="color:#64748b;font-size:13px;">${orgName}</p>
          </div>`;

        await sendTransactionalEmail({
          orgId: member.org_id,
          orgName,
          to,
          subject,
          textBody,
          htmlBody,
        });

        return new Response(
          JSON.stringify({
            sent: true,
            to,
            payment_url: url,
            invoice_id: invoice.id,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } catch (error) {
        console.error("send_client_invoice_payment_link.error", error);
        return createErrorResponse(
          500,
          error instanceof Error ? error.message : "Unexpected error",
        );
      }
    });
  }),
);
