import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { createStorageSignedUrl } from "../_shared/storageObjectUrl.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { loadPortalSession } from "../_shared/portalSession.ts";

type ClientPortalBody = {
  token?: string;
  portal_session?: string;
  deal_id?: number;
  action?: "mark_notification_read" | "bootstrap";
  notification_id?: number;
};

const sanitizeDeal = (deal: Record<string, unknown>) => ({
  id: deal.id,
  name: deal.name,
  stage: deal.stage,
  project_type: deal.project_type,
  expected_end_date: deal.expected_end_date,
  production_url: deal.production_url,
  staging_url: deal.staging_url,
  created_at: deal.created_at,
});

const sanitizeDelivery = (delivery: Record<string, unknown>) => ({
  id: delivery.id,
  delivered_at: delivery.delivered_at,
  site_url: delivery.site_url,
  plan_name: delivery.plan_name,
  project_start_date: delivery.project_start_date,
  delivery_date: delivery.delivery_date,
  hosting_renewal_date: delivery.hosting_renewal_date,
  hosting_status: delivery.hosting_status,
  site_language: delivery.site_language,
  included_pages: delivery.included_pages,
  maintenance_plan: delivery.maintenance_plan,
  enabled_sections: delivery.enabled_sections,
  domain_info: delivery.domain_info,
  marketing_info: delivery.marketing_info,
  onboarding_info: delivery.onboarding_info,
});

type ResourceFile = {
  title?: string;
  type?: string;
  path?: string;
  src?: string;
  bucket?: string;
  size?: number;
};

const parseDomainFromUrl = (siteUrl?: string | null) => {
  if (!siteUrl?.trim()) return "";
  try {
    const href = siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`;
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return siteUrl
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0];
  }
};

const signResourceUrls = async (file: ResourceFile) => {
  const path = file.path?.trim();
  const mimeType = file.type?.trim() || "application/octet-stream";
  const fileName = file.title?.trim() || "file";
  const isImage = mimeType.startsWith("image/");

  if (!path) {
    const fallback = file.src?.trim() || null;
    return {
      file_name: fileName,
      mime_type: mimeType,
      is_image: isImage,
      download_url: fallback,
      preview_url: fallback,
      size_bytes: file.size ?? null,
    };
  }

  const bucket = file.bucket?.trim() || "project-files";
  if (bucket === "attachments") {
    const signed = await createStorageSignedUrl(
      supabaseAdmin,
      "attachments",
      path,
      3600,
    );
    const fallback = file.src?.trim() || null;
    const downloadUrl = signed ?? fallback;
    return {
      file_name: fileName,
      mime_type: mimeType,
      is_image: isImage,
      download_url: downloadUrl,
      preview_url: downloadUrl,
      size_bytes: file.size ?? null,
    };
  }

  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(path, 3600);

  if (error || !data?.signedUrl) {
    const fallback = file.src?.trim() || null;
    return {
      file_name: fileName,
      mime_type: mimeType,
      is_image: isImage,
      download_url: fallback,
      preview_url: fallback,
      size_bytes: file.size ?? null,
    };
  }

  return {
    file_name: fileName,
    mime_type: mimeType,
    is_image: isImage,
    download_url: data.signedUrl,
    preview_url: isImage ? data.signedUrl : null,
    size_bytes: file.size ?? null,
  };
};

const sanitizePortalResource = async (row: Record<string, unknown>) => {
  const file =
    row.file && typeof row.file === "object" ? (row.file as ResourceFile) : {};
  const signed = await signResourceUrls(file);
  return {
    id: row.id,
    category: row.category,
    label: row.label,
    created_at: row.created_at,
    ...signed,
  };
};

const sanitizeDomain = (row: Record<string, unknown>) => ({
  id: row.id,
  domain: row.domain,
  registrar: row.registrar,
  registered_at: row.registered_at,
  renewal_date: row.renewal_date,
  managed_by: row.managed_by,
  auto_renew: row.auto_renew,
  dns_servers: Array.isArray(row.dns_servers) ? row.dns_servers : [],
});

const sanitizeCorporateEmail = (row: Record<string, unknown>) => ({
  id: row.id,
  email: row.email,
  config_notes: row.config_notes,
  has_password: row.has_password,
});

const sanitizePortalInvoice = (
  row: Record<string, unknown>,
  portalToken?: string | null,
) => ({
  id: row.id,
  invoice_number: row.invoice_number,
  issue_date: row.issue_date,
  due_date: row.due_date,
  amount: Number(row.amount ?? 0),
  amount_paid: Number(row.amount_paid ?? 0),
  currency: row.currency ?? "USD",
  status: row.status,
  description: row.description,
  paid_at: row.paid_at,
  reference: row.reference,
  portal_token: portalToken ?? null,
});

Deno.serve(
  OptionsMiddleware(async (req) => {
    try {
      const body = (await req.json()) as ClientPortalBody;
      const token = body.token?.trim();
      if (!token) {
        return createErrorResponse(400, "Missing portal token");
      }

      const { data: account, error: accountError } = await supabaseAdmin
        .from("client_portal_accounts")
        .select("id, org_id, email, active")
        .eq("invitation_token", token)
        .eq("active", true)
        .maybeSingle();

      if (accountError || !account?.id) {
        return createErrorResponse(403, "Invalid or expired portal link");
      }

      if (body.action === "bootstrap") {
        return new Response(
          JSON.stringify({
            account: { email: account.email },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const portalSession = body.portal_session?.trim();
      if (!portalSession) {
        return createErrorResponse(401, "Portal session required");
      }
      const activeSession = await loadPortalSession(account.id, portalSession);
      if (!activeSession) {
        return createErrorResponse(401, "Portal session expired");
      }

      if (body.action === "mark_notification_read" && body.notification_id) {
        await supabaseAdmin
          .from("project_delivery_notifications")
          .update({ read_at: new Date().toISOString() })
          .eq("id", body.notification_id)
          .eq("portal_account_id", account.id);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabaseAdmin
        .from("client_portal_accounts")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", account.id);

      const { data: notifications = [] } = await supabaseAdmin
        .from("project_delivery_notifications")
        .select("id, deal_id, delivery_id, title, body, read_at, created_at")
        .eq("portal_account_id", account.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (body.deal_id) {
        const dealId = Number(body.deal_id);
        const { data: access } = await supabaseAdmin
          .from("client_portal_deal_access")
          .select("deal_id")
          .eq("portal_account_id", account.id)
          .eq("deal_id", dealId)
          .maybeSingle();

        if (!access?.deal_id) {
          return createErrorResponse(
            403,
            "Project not shared with this client",
          );
        }

        const { data: deal, error: dealError } = await supabaseAdmin
          .from("deals")
          .select(
            "id, name, stage, project_type, expected_end_date, production_url, staging_url, website_brief, created_at",
          )
          .eq("id", dealId)
          .eq("org_id", account.org_id)
          .maybeSingle();

        if (dealError || !deal) {
          return createErrorResponse(404, "Project not found");
        }

        const { data: delivery } = await supabaseAdmin
          .from("project_deliveries")
          .select(
            "id, delivered_at, site_url, plan_name, project_start_date, delivery_date, hosting_renewal_date, hosting_status, site_language, included_pages, maintenance_plan, enabled_sections, domain_info, marketing_info, onboarding_info",
          )
          .eq("deal_id", dealId)
          .eq("org_id", account.org_id)
          .is("revoked_at", null)
          .maybeSingle();

        const { data: sharedLogins = [] } = delivery
          ? await supabaseAdmin
              .from("deal_access_entries")
              .select(
                "id, label, url, username, managed_by, service_kind, portal_sort_order, has_password, password_updated_at",
              )
              .eq("deal_id", dealId)
              .eq("org_id", account.org_id)
              .eq("shared_with_client", true)
              .order("portal_sort_order", { ascending: true })
          : { data: [] };

        const { data: sharedSecrets = [] } = delivery
          ? await supabaseAdmin
              .from("deal_secrets")
              .select("id, label, has_secret, updated_at")
              .eq("deal_id", dealId)
              .eq("org_id", account.org_id)
              .eq("shared_with_client", true)
              .order("created_at", { ascending: true })
          : { data: [] };

        const sharedCredentials = [
          ...(sharedLogins ?? []),
          ...(sharedSecrets ?? []).map((row) => ({
            id: row.id,
            label: row.label,
            kind: "api_key",
            secret_label: "API key",
            url: null,
            username: null,
            managed_by: "lbs",
            service_kind: null,
            portal_sort_order: 999,
            has_password: row.has_secret,
            password_updated_at: row.updated_at,
          })),
        ];

        const { data: clientResources = [] } = delivery
          ? await supabaseAdmin
              .from("deal_resources")
              .select("id, category, label, file, created_at")
              .eq("deal_id", dealId)
              .in("visibility", ["client", "public"])
              .order("created_at", { ascending: false })
              .limit(100)
          : { data: [] };

        const { data: domainRows = [] } = delivery
          ? await supabaseAdmin
              .from("project_delivery_domains")
              .select(
                "id, domain, registrar, registered_at, renewal_date, managed_by, auto_renew, dns_servers",
              )
              .eq("delivery_id", delivery.id)
              .eq("deal_id", dealId)
              .order("created_at", { ascending: true })
          : { data: [] };

        const { data: corporateEmailRows = [] } = delivery
          ? await supabaseAdmin
              .from("project_delivery_corporate_emails")
              .select("id, email, config_notes, has_password")
              .eq("delivery_id", delivery.id)
              .eq("deal_id", dealId)
              .order("created_at", { ascending: true })
          : { data: [] };

        const resources = await Promise.all(
          clientResources.map((row) =>
            sanitizePortalResource(row as Record<string, unknown>),
          ),
        );

        let domains = domainRows.map((row) =>
          sanitizeDomain(row as Record<string, unknown>),
        );
        if (domains.length === 0 && delivery.site_url) {
          const inferred = parseDomainFromUrl(String(delivery.site_url));
          if (inferred) {
            domains = [{ domain: inferred }];
          }
        }

        const corporateEmails = corporateEmailRows.map((row) =>
          sanitizeCorporateEmail(row as Record<string, unknown>),
        );

        const { data: invoiceRows = [] } = delivery
          ? await supabaseAdmin
              .from("client_invoices")
              .select(
                "id, invoice_number, issue_date, due_date, amount, amount_paid, currency, status, description, paid_at, reference",
              )
              .eq("deal_id", dealId)
              .eq("org_id", account.org_id)
              .neq("status", "void")
              .neq("status", "draft")
              .order("issue_date", { ascending: false })
              .limit(50)
          : { data: [] };

        const invoiceIds = (invoiceRows ?? [])
          .map((row) => Number(row.id))
          .filter((id) => Number.isFinite(id));
        const tokenByInvoiceId = new Map<number, string>();
        if (invoiceIds.length > 0) {
          const { data: tokenRows = [] } = await supabaseAdmin
            .from("public_client_invoice_tokens")
            .select("invoice_id, token, created_at")
            .in("invoice_id", invoiceIds)
            .order("created_at", { ascending: false });
          for (const row of tokenRows) {
            const invoiceId = Number(row.invoice_id);
            if (!tokenByInvoiceId.has(invoiceId) && row.token) {
              tokenByInvoiceId.set(invoiceId, String(row.token));
            }
          }
        }

        const invoices = (invoiceRows ?? []).map((row) =>
          sanitizePortalInvoice(
            row as Record<string, unknown>,
            tokenByInvoiceId.get(Number(row.id)) ?? null,
          ),
        );

        const { data: projectPaymentRows = [] } = delivery
          ? await supabaseAdmin
              .from("deal_client_payments")
              .select(
                "id, payment_date, amount, payment_method, reference_number, check_number, status, notes",
              )
              .eq("deal_id", dealId)
              .order("payment_date", { ascending: false })
              .limit(50)
          : { data: [] };

        const invoicePayments = invoices
          .filter(
            (invoice) =>
              Number(invoice.amount_paid) > 0 || invoice.status === "paid",
          )
          .map((invoice) => ({
            id: `invoice-${invoice.id}`,
            payment_date: String(invoice.paid_at ?? invoice.issue_date),
            amount:
              Number(invoice.amount_paid) > 0
                ? Number(invoice.amount_paid)
                : Number(invoice.amount),
            payment_method: "card",
            reference_number: invoice.reference,
            check_number: null,
            status: invoice.status === "paid" ? "paid" : "partial",
            notes: invoice.description,
            source: "invoice" as const,
            invoice_number: String(invoice.invoice_number),
          }));

        const projectPayments = (projectPaymentRows ?? []).map((row) => ({
          id: row.id,
          payment_date: row.payment_date,
          amount: Number(row.amount ?? 0),
          payment_method: row.payment_method,
          reference_number: row.reference_number,
          check_number: row.check_number,
          status: row.status,
          notes: row.notes,
          source: "project" as const,
          invoice_number: null,
        }));

        const payments = [...invoicePayments, ...projectPayments].sort(
          (left, right) =>
            String(right.payment_date).localeCompare(String(left.payment_date)),
        );

        const { data: approvals = [] } = await supabaseAdmin
          .from("deal_approvals")
          .select(
            "id, title, description, resource_type, resource_url, status, created_at, expires_at",
          )
          .eq("deal_id", dealId)
          .order("created_at", { ascending: false })
          .limit(20);

        return new Response(
          JSON.stringify({
            account: { email: account.email },
            project: sanitizeDeal(deal as Record<string, unknown>),
            delivery: delivery
              ? sanitizeDelivery(delivery as Record<string, unknown>)
              : null,
            credentials: sharedCredentials,
            resources,
            domains,
            corporate_emails: corporateEmails,
            invoices,
            payments,
            approvals,
            notifications,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: accessRows = [] } = await supabaseAdmin
        .from("client_portal_deal_access")
        .select("deal_id")
        .eq("portal_account_id", account.id);

      const dealIds = accessRows.map((row) => row.deal_id).filter(Boolean);
      if (dealIds.length === 0) {
        return new Response(
          JSON.stringify({
            account: { email: account.email },
            projects: [],
            notifications,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: deals = [] } = await supabaseAdmin
        .from("deals")
        .select(
          "id, name, stage, project_type, expected_end_date, production_url, staging_url, created_at",
        )
        .in("id", dealIds)
        .eq("org_id", account.org_id)
        .is("archived_at", null);

      const { data: deliveries = [] } = await supabaseAdmin
        .from("project_deliveries")
        .select("deal_id, delivered_at, site_url, delivery_date")
        .in("deal_id", dealIds)
        .eq("org_id", account.org_id)
        .is("revoked_at", null);

      const deliveryByDeal = Object.fromEntries(
        deliveries.map((entry) => [entry.deal_id, entry]),
      );

      return new Response(
        JSON.stringify({
          account: { email: account.email },
          projects: deals.map((deal) => ({
            ...sanitizeDeal(deal as Record<string, unknown>),
            delivery: deliveryByDeal[deal.id] ?? null,
          })),
          notifications,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (error) {
      console.error("client_portal.error", error);
      return createErrorResponse(
        error instanceof Error ? error.message : "Unexpected error",
        500,
      );
    }
  }),
);
