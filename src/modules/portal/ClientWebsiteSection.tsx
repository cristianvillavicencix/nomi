import { useState } from "react";
import { Copy, ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ClientBillingSection } from "@/modules/portal/ClientBillingSection";
import { ClientCorporateEmailsSection } from "@/modules/portal/ClientCorporateEmailsSection";
import { ClientCredentialsSection } from "@/modules/portal/ClientCredentialsSection";
import { ClientDomainPortalSection } from "@/modules/portal/ClientDomainPortalSection";
import { ClientFilesSection } from "@/modules/portal/ClientFilesSection";
import { ClientHandoffSection } from "@/modules/portal/ClientHandoffSection";
import { ClientHostingSection } from "@/modules/portal/ClientHostingSection";
import { ClientOverviewSection } from "@/modules/portal/ClientOverviewSection";
import type { PortalCopy, PortalLocale } from "@/modules/portal/portalI18n";
import { PORTAL_LOCALE_KEY } from "@/modules/portal/portalI18n";
import { downloadPortalDeliveryPdf } from "@/modules/portal/portalDeliveryPdfExport";
import { PORTAL_DELIVERY_NAV } from "@/modules/portal/portalNavigation";
import { PortalUserMenu } from "@/modules/portal/PortalUserMenu";
import {
  normalizePortalEnabledSections,
  type PortalCorporateEmail,
  type PortalCredential,
  type PortalDelivery,
  type PortalDomain,
  type PortalInvoice,
  type PortalPayment,
  type PortalProject,
  type PortalResource,
  type PortalView,
} from "@/modules/portal/portalTypes";

export const ClientWebsiteSection = ({
  project,
  delivery,
  copy,
  locale,
  onLocaleChange,
  portalToken,
  accountEmail,
  credentials = [],
  resources = [],
  domains = [],
  corporateEmails = [],
  invoices = [],
  payments = [],
  activeView,
  onViewChange,
  onSignOut,
}: {
  project: PortalProject;
  delivery: PortalDelivery;
  copy: PortalCopy;
  locale: PortalLocale;
  onLocaleChange: (next: PortalLocale) => void;
  portalToken: string;
  accountEmail?: string | null;
  credentials?: PortalCredential[];
  resources?: PortalResource[];
  domains?: PortalDomain[];
  corporateEmails?: PortalCorporateEmail[];
  invoices?: PortalInvoice[];
  payments?: PortalPayment[];
  activeView: PortalView;
  onViewChange: (view: PortalView) => void;
  onSignOut: () => void;
}) => {
  const [copied, setCopied] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const siteUrl = delivery.site_url || project.production_url || "";
  const stagingUrl = project.staging_url ?? "";
  const enabled = new Set(normalizePortalEnabledSections(delivery.enabled_sections));
  const tabs = PORTAL_DELIVERY_NAV.filter((tab) => enabled.has(tab.id));
  const activeTab = enabled.has(activeView) ? activeView : (tabs[0]?.id ?? "overview");

  const href = siteUrl
    ? siteUrl.startsWith("http")
      ? siteUrl
      : `https://${siteUrl}`
    : "";

  const handleCopy = async () => {
    if (!href) return;
    await navigator.clipboard.writeText(href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPdf = () => {
    setDownloadingPdf(true);
    try {
      downloadPortalDeliveryPdf({
        projectName: project.name,
        delivery,
        siteUrl,
        stagingUrl,
        credentials,
        locale,
      });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const renderActiveSection = () => {
    if (activeTab === "overview") {
      return (
        <ClientOverviewSection delivery={delivery} copy={copy} locale={locale} />
      );
    }
    if (activeTab === "hosting") {
      return (
        <ClientHostingSection
          delivery={delivery}
          siteUrl={siteUrl}
          stagingUrl={stagingUrl}
          credentials={credentials}
          portalToken={portalToken}
          dealId={project.id}
          accountEmail={accountEmail}
          copy={copy}
          locale={locale}
        />
      );
    }
    if (activeTab === "domain") {
      return (
        <ClientDomainPortalSection
          delivery={delivery}
          domains={domains}
          credentials={credentials}
          portalToken={portalToken}
          dealId={project.id}
          accountEmail={accountEmail}
          copy={copy}
          locale={locale}
        />
      );
    }
    if (activeTab === "billing") {
      return (
        <ClientBillingSection
          invoices={invoices}
          payments={payments}
          copy={copy}
          locale={locale}
        />
      );
    }
    if (activeTab === "handoff") {
      return <ClientHandoffSection locale={locale} />;
    }
    if (activeTab === "files") {
      return <ClientFilesSection resources={resources} copy={copy} />;
    }
    return (
      <div className="space-y-8">
        <ClientCredentialsSection
          portalToken={portalToken}
          dealId={project.id}
          accountEmail={accountEmail}
          credentials={credentials}
          copy={copy}
          locale={locale}
        />
        <ClientCorporateEmailsSection emails={corporateEmails} copy={copy} />
      </div>
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <div className="border-b px-4 py-5 sm:px-6">
        <div className="flex items-start justify-end gap-2">
          <PortalUserMenu
            copy={copy}
            accountEmail={accountEmail}
            onSignOut={onSignOut}
          />
          <button
            type="button"
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            onClick={() => {
              const next = locale === "es" ? "en" : "es";
              localStorage.setItem(PORTAL_LOCALE_KEY, next);
              onLocaleChange(next);
            }}
          >
            {copy.languageToggle}
          </button>
        </div>

        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-foreground">{project.name}</h1>
            {siteUrl ? (
              <p className="mt-1 truncate text-sm text-muted-foreground">{siteUrl}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              asChild
              size="sm"
              className="h-9"
              disabled={!href}
            >
              <a href={href} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" />
                {copy.visitSite}
              </a>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9"
              disabled={!href}
              onClick={() => void handleCopy()}
            >
              <Copy className="size-4" />
              {copied ? copy.linkCopied : copy.copyLink}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9"
              disabled={downloadingPdf}
              onClick={handleDownloadPdf}
            >
              <FileText className="size-4" />
              {downloadingPdf ? copy.downloadingSummary : copy.downloadSummary}
            </Button>
          </div>
        </div>
      </div>

      {tabs.length > 1 ? (
        <div className="border-b px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto py-2">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onViewChange(tab.id)}
                  className={cn(
                    "shrink-0 rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab.label(copy)}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="flex-1 px-4 py-6 sm:px-6">{renderActiveSection()}</div>

      <footer className="mt-auto border-t px-4 py-5 text-center text-xs text-muted-foreground sm:px-6">
        {accountEmail ? (
          <p>
            {copy.portalAccount}: {accountEmail}
          </p>
        ) : null}
        <p className={accountEmail ? "mt-1" : undefined}>{copy.portalFooter}</p>
      </footer>
    </div>
  );
};
