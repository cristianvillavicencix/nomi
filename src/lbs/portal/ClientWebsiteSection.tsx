import { useMemo, useState } from "react";
import { CheckCircle2, Copy, ExternalLink, PartyPopper } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { ClientCredentialsSection } from "@/lbs/portal/ClientCredentialsSection";
import { ClientCorporateEmailsSection } from "@/lbs/portal/ClientCorporateEmailsSection";
import { ClientDomainSection } from "@/lbs/portal/ClientDomainSection";
import { ClientFilesSection } from "@/lbs/portal/ClientFilesSection";
import type { PortalCopy } from "@/lbs/portal/portalI18n";
import {
  DEFAULT_INCLUDED_PAGES,
  developmentDurationDays,
  formatPortalDate,
  type PortalCorporateEmail,
  type PortalCredential,
  type PortalDelivery,
  type PortalDomain,
  type PortalProject,
  type PortalResource,
} from "@/lbs/portal/portalTypes";

const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="rounded-lg border bg-background/80 px-4 py-3">
    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </div>
    <div className="mt-1 text-sm font-medium text-[#0D3B6E]">{value}</div>
  </div>
);

const hostingStatusLabel = (status: string | null | undefined, copy: PortalCopy) => {
  if (status === "expired") {
    return <Badge variant="destructive">{copy.hostingExpired}</Badge>;
  }
  if (status === "pending") {
    return <Badge variant="outline">{copy.hostingPending}</Badge>;
  }
  return (
    <Badge className="bg-emerald-600 hover:bg-emerald-600">{copy.hostingActive}</Badge>
  );
};

export const ClientWebsiteSection = ({
  project,
  delivery,
  copy,
  locale,
  portalToken,
  accountEmail,
  credentials = [],
  resources = [],
  domains = [],
  corporateEmails = [],
}: {
  project: PortalProject;
  delivery: PortalDelivery;
  copy: PortalCopy;
  locale: "es" | "en";
  portalToken: string;
  accountEmail?: string | null;
  credentials?: PortalCredential[];
  resources?: PortalResource[];
  domains?: PortalDomain[];
  corporateEmails?: PortalCorporateEmail[];
}) => {
  const [copied, setCopied] = useState(false);
  const siteUrl = delivery.site_url || project.production_url || "";
  const localeTag = locale === "es" ? "es-US" : "en-US";
  const durationDays = useMemo(
    () =>
      developmentDurationDays(
        delivery.project_start_date,
        delivery.delivery_date,
      ),
    [delivery.delivery_date, delivery.project_start_date],
  );
  const pages =
    delivery.included_pages?.length ? delivery.included_pages : DEFAULT_INCLUDED_PAGES;
  const enabled = new Set(delivery.enabled_sections ?? ["general"]);

  const handleCopy = async () => {
    if (!siteUrl) return;
    const normalized = siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`;
    await navigator.clipboard.writeText(normalized);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const href = siteUrl
    ? siteUrl.startsWith("http")
      ? siteUrl
      : `https://${siteUrl}`
    : "";

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-[#1E5FA8]/20 bg-gradient-to-br from-[#1E5FA8] to-[#0D3B6E] text-white">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-start gap-3">
            <PartyPopper className="mt-1 size-6 shrink-0 text-[#F59E0B]" />
            <div>
              <h1 className="text-xl font-bold md:text-2xl">{copy.deliveryReady}</h1>
              {siteUrl ? (
                <p className="mt-2 break-all text-base text-white/90">{siteUrl}</p>
              ) : null}
              <p className="mt-1 text-sm text-white/80">
                {copy.deliveredOn}{" "}
                {formatPortalDate(delivery.delivery_date ?? delivery.delivered_at, localeTag)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {href ? (
              <Button
                asChild
                className="bg-[#F59E0B] text-[#0D3B6E] hover:bg-[#F59E0B]/90"
              >
                <a href={href} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                  {copy.visitSite}
                </a>
              </Button>
            ) : null}
            {href ? (
              <Button
                type="button"
                variant="secondary"
                className="bg-white/15 text-white hover:bg-white/25"
                onClick={() => void handleCopy()}
              >
                <Copy className="size-4" />
                {copied ? copy.linkCopied : copy.copyLink}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              disabled
              className="bg-white/10 text-white/80"
            >
              {copy.downloadSummary}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Accordion
        type="multiple"
        defaultValue={enabled.has("general") ? ["general"] : []}
        className="space-y-3"
      >
        {enabled.has("general") ? (
          <AccordionItem value="general" className="rounded-lg border px-4">
            <AccordionTrigger className="text-base font-semibold text-[#0D3B6E]">
              📋 {copy.generalInfo}
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pb-4">
              <div className="grid gap-3 md:grid-cols-2">
                <InfoRow label={copy.siteUrl} value={siteUrl || "—"} />
                <InfoRow label={copy.plan} value={delivery.plan_name || "—"} />
                <InfoRow
                  label={copy.deliveryDate}
                  value={formatPortalDate(
                    delivery.delivery_date ?? delivery.delivered_at,
                    localeTag,
                  )}
                />
                <InfoRow
                  label={copy.startDate}
                  value={formatPortalDate(delivery.project_start_date, localeTag)}
                />
                <InfoRow
                  label={copy.devDuration}
                  value={
                    durationDays != null ? `${durationDays} ${copy.days}` : "—"
                  }
                />
                <InfoRow
                  label={copy.hostingRenewal}
                  value={formatPortalDate(delivery.hosting_renewal_date, localeTag)}
                />
                <InfoRow
                  label={copy.hostingStatus}
                  value={hostingStatusLabel(delivery.hosting_status, copy)}
                />
                <InfoRow
                  label={copy.siteLanguage}
                  value={delivery.site_language || "—"}
                />
              </div>
              <div className="rounded-lg border px-4 py-3">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {copy.includedPages}
                </div>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {pages.map((page) => (
                    <li key={page} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="size-4 text-emerald-600" />
                      {page}
                    </li>
                  ))}
                </ul>
              </div>
            </AccordionContent>
          </AccordionItem>
        ) : null}

        {[
          { id: "credentials", title: `🔐 ${copy.credentialsTitle}`, enabled: enabled.has("credentials") },
          { id: "corporate_email", title: `📧 ${copy.corporateEmailSection}`, enabled: enabled.has("corporate_email") },
          { id: "domain_dns", title: `🌍 ${copy.domainDnsSection}`, enabled: enabled.has("domain_dns") },
          { id: "files", title: `📁 ${copy.filesSection}`, enabled: enabled.has("files") },
          { id: "marketing_seo", title: `📈 ${copy.marketingSeoSection}`, enabled: enabled.has("marketing_seo") },
          { id: "onboarding", title: `🎓 ${copy.onboardingSection}`, enabled: enabled.has("onboarding") },
          { id: "support", title: `📞 ${copy.supportSection}`, enabled: enabled.has("support") },
        ]
          .filter((section) => section.enabled)
          .map((section) => (
            <AccordionItem key={section.id} value={section.id} className="rounded-lg border px-4">
              <AccordionTrigger className="text-base font-semibold text-[#0D3B6E]">
                {section.title}
              </AccordionTrigger>
              <AccordionContent className="pb-4 text-sm">
                {section.id === "credentials" ? (
                  <ClientCredentialsSection
                    portalToken={portalToken}
                    dealId={project.id}
                    accountEmail={accountEmail}
                    credentials={credentials}
                    copy={copy}
                    locale={locale}
                  />
                ) : section.id === "corporate_email" ? (
                  <ClientCorporateEmailsSection
                    emails={corporateEmails}
                    copy={copy}
                  />
                ) : section.id === "domain_dns" ? (
                  <ClientDomainSection
                    domains={domains}
                    siteUrl={siteUrl}
                    copy={copy}
                    locale={locale}
                  />
                ) : section.id === "files" ? (
                  <ClientFilesSection resources={resources} copy={copy} />
                ) : (
                  <p className="text-muted-foreground">{copy.comingSoon}</p>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
      </Accordion>
    </div>
  );
};
