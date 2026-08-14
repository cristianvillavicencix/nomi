import { useState } from "react";
import {
  Copy,
  Download,
  ExternalLink,
  Mail,
  Printer,
} from "lucide-react";
import { useNotify } from "ra-core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadPortalDeliveryPdf } from "@/modules/portal/portalDeliveryPdfExport";
import type { PortalCredential, PortalDelivery } from "@/modules/portal/portalTypes";
import type { DealAccessEntry, ProjectDelivery } from "@/modules/types";

const mapCredentials = (entries: DealAccessEntry[]): PortalCredential[] =>
  entries.map((entry) => ({
    id: Number(entry.id),
    label: entry.label,
    kind: entry.kind,
    secret_label: entry.secret_label,
    url: entry.url,
    username: entry.username,
    managed_by: entry.managed_by,
    service_kind: entry.service_kind,
    portal_sort_order: entry.portal_sort_order,
    has_password: Boolean(entry.has_password || entry.password),
    password_updated_at: entry.password_updated_at,
    notes: entry.notes,
  }));

const toPortalDelivery = (
  delivery: ProjectDelivery,
  siteUrl: string,
): PortalDelivery => ({
  id: Number(delivery.id),
  delivered_at: delivery.delivered_at ?? new Date().toISOString(),
  site_url: delivery.site_url ?? siteUrl,
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
});

const buildPrintHtml = ({
  projectName,
  siteUrl,
  clientEmail,
  portalLink,
  planName,
  domainName,
  hostingProvider,
}: {
  projectName: string;
  siteUrl: string;
  clientEmail: string;
  portalLink: string | null;
  planName: string;
  domainName: string;
  hostingProvider: string;
}) => `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${projectName} — Delivery</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 40px; color: #111; }
    h1 { font-size: 22px; margin: 0 0 8px; }
    p { margin: 4px 0; font-size: 13px; }
    .muted { color: #666; }
    .box { border: 1px solid #ddd; border-radius: 8px; padding: 12px; margin-top: 16px; }
  </style>
</head>
<body>
  <h1>Website delivery</h1>
  <p><strong>Project:</strong> ${projectName}</p>
  ${siteUrl ? `<p><strong>Live site:</strong> ${siteUrl}</p>` : ""}
  ${planName ? `<p><strong>Plan:</strong> ${planName}</p>` : ""}
  ${domainName ? `<p><strong>Domain:</strong> ${domainName}</p>` : ""}
  ${hostingProvider ? `<p><strong>Hosting:</strong> ${hostingProvider}</p>` : ""}
  ${clientEmail ? `<p><strong>Client email:</strong> ${clientEmail}</p>` : ""}
  ${
    portalLink
      ? `<div class="box"><p class="muted">Client portal</p><p>${portalLink}</p><p class="muted">Passwords are only available in the portal.</p></div>`
      : ""
  }
</body>
</html>`;

export const ProjectDeliveryDoneActions = ({
  projectName,
  siteUrl,
  stagingUrl,
  planName,
  domainName,
  hostingProvider,
  clientEmail,
  portalLink,
  delivery,
  credentials,
  emailAlreadyQueued,
}: {
  projectName: string;
  siteUrl: string;
  stagingUrl?: string | null;
  planName: string;
  domainName: string;
  hostingProvider: string;
  clientEmail: string;
  portalLink: string | null;
  delivery: ProjectDelivery;
  credentials: DealAccessEntry[];
  emailAlreadyQueued?: boolean;
}) => {
  const notify = useNotify();
  const [downloading, setDownloading] = useState(false);

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      await downloadPortalDeliveryPdf({
        projectName,
        delivery: toPortalDelivery(delivery, siteUrl),
        siteUrl,
        stagingUrl,
        credentials: mapCredentials(credentials),
        locale: "en",
      });
      notify("Delivery PDF downloaded", { type: "info" });
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Could not download PDF",
        { type: "error" },
      );
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    const html = buildPrintHtml({
      projectName,
      siteUrl,
      clientEmail,
      portalLink,
      planName,
      domainName,
      hostingProvider,
    });
    const popup = window.open("", "_blank", "noopener,noreferrer,width=800,height=900");
    if (!popup) {
      notify("Allow pop-ups to print the delivery summary", { type: "warning" });
      return;
    }
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  const handleSendEmail = () => {
    if (!clientEmail) {
      notify("Client contact needs an email", { type: "warning" });
      return;
    }
    const subject = encodeURIComponent(`Your website ${projectName} is ready`);
    const body = encodeURIComponent(
      [
        `Hi,`,
        ``,
        `Your website project is ready.`,
        siteUrl ? `Live site: ${siteUrl}` : null,
        portalLink
          ? `Open your client portal (credentials and handoff details): ${portalLink}`
          : null,
        ``,
        `Passwords are only available in the portal for security.`,
      ]
        .filter(Boolean)
        .join("\n"),
    );
    window.location.href = `mailto:${encodeURIComponent(clientEmail)}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        Delivery saved. The client can open their portal
        {emailAlreadyQueued ? ", and a notification email was queued" : ""}.
      </div>

      {portalLink ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Client portal link</p>
          <Input readOnly value={portalLink} className="text-xs" />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(portalLink);
                notify("Portal link copied", { type: "info" });
              }}
            >
              <Copy className="size-4" />
              Copy link
            </Button>
            <Button type="button" variant="secondary" size="sm" asChild>
              <a href={portalLink} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" />
                Open portal
              </a>
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-3">
        <Button
          type="button"
          variant="secondary"
          disabled={downloading}
          onClick={() => void handleDownloadPdf()}
        >
          <Download className="size-4" />
          {downloading ? "Preparing…" : "Download PDF"}
        </Button>
        <Button type="button" variant="secondary" onClick={handlePrint}>
          <Printer className="size-4" />
          Print
        </Button>
        <Button type="button" variant="secondary" onClick={handleSendEmail}>
          <Mail className="size-4" />
          Send email
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        The PDF omits passwords. Clients view credentials in the portal.
      </p>
    </div>
  );
};
