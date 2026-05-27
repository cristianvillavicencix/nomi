import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  Folder,
  Globe,
  GraduationCap,
  Headphones,
  KeyRound,
  Mail,
  Megaphone,
  PartyPopper,
  Phone,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  type PortalView,
} from "@/lbs/portal/portalTypes";

const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="rounded-lg bg-muted/40 p-3">
    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {label}
    </div>
    <div className="mt-1 text-[13px] font-semibold text-foreground">{value}</div>
  </div>
);

const EmptyState = ({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) => (
  <div className="flex flex-col items-center justify-center gap-3 rounded-lg bg-muted/20 p-10 text-center">
    <div className="text-muted-foreground">{icon}</div>
    <div className="text-sm font-semibold">{title}</div>
    <div className="max-w-md text-sm text-muted-foreground">{description}</div>
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
  activeView,
  onViewChange,
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
  activeView: PortalView;
  onViewChange: (view: PortalView) => void;
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
  const activeTab = activeView;

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

  const tabs: Array<{ id: PortalView; label: string; icon: React.ReactNode }> = [
    { id: "general", label: "General", icon: <PartyPopper className="size-4" /> },
    { id: "credentials", label: "Credenciales", icon: <KeyRound className="size-4" /> },
    { id: "corporate_email", label: "Correo corporativo", icon: <Mail className="size-4" /> },
    { id: "domain_dns", label: "Dominio y DNS", icon: <Globe className="size-4" /> },
    { id: "files", label: "Archivos del proyecto", icon: <Folder className="size-4" /> },
    { id: "marketing_seo", label: "Marketing y SEO", icon: <Megaphone className="size-4" /> },
    { id: "training", label: "Capacitación", icon: <GraduationCap className="size-4" /> },
    { id: "support", label: "Soporte", icon: <Headphones className="size-4" /> },
  ];

  return (
    <div className="bg-white">
      <div className="border-b bg-white px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <span className="relative inline-flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-40" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-600" />
              </span>
              En vivo
            </span>
            <div className="min-w-0 truncate text-sm font-semibold text-[#1E5FA8]">
              {siteUrl || "—"}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              asChild
              size="sm"
              className="h-8 bg-[#1E5FA8] px-3 text-white hover:bg-[#1E5FA8]/90"
              disabled={!href}
            >
              <a href={href} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" />
                Visitar sitio
              </a>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 border px-3"
              disabled={!href}
              onClick={() => void handleCopy()}
            >
              <Copy className="size-4" />
              {copied ? "Copiado" : "Copiar"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 border px-3"
              disabled
            >
              <FileText className="size-4" />
              PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="border-b bg-white px-6">
        <div className="flex flex-wrap gap-6">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const isDisabled = tab.id !== "general" && !enabled.has(tab.id);
            return (
              <button
                key={tab.id}
                type="button"
                disabled={isDisabled}
                onClick={() => onViewChange(tab.id)}
                className={
                  "relative flex items-center gap-2 py-3 text-sm " +
                  (isDisabled ? "opacity-50 cursor-not-allowed" : "")
                }
              >
                <span className={isActive ? "text-[#1E5FA8]" : "text-muted-foreground"}>
                  {tab.icon}
                </span>
                <span className={isActive ? "font-semibold text-foreground" : "text-muted-foreground"}>
                  {tab.label}
                </span>
                <span
                  className={
                    isActive
                      ? "absolute bottom-0 left-0 h-0.5 w-full bg-[#1E5FA8]"
                      : "absolute bottom-0 left-0 h-0.5 w-full bg-transparent"
                  }
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white p-6">
        {activeTab === "general" ? (
          <div className="space-y-4">
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
                value={durationDays != null ? `${durationDays} ${copy.days}` : "—"}
              />
              <InfoRow
                label={copy.hostingRenewal}
                value={formatPortalDate(delivery.hosting_renewal_date, localeTag)}
              />
              <InfoRow
                label={copy.hostingStatus}
                value={hostingStatusLabel(delivery.hosting_status, copy)}
              />
              <InfoRow label={copy.siteLanguage} value={delivery.site_language || "—"} />
            </div>

            <div className="rounded-lg bg-muted/40 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {copy.includedPages}
              </div>
              <ul className="mt-3 grid gap-2 sm:grid-cols-3">
                {pages.map((page) => (
                  <li key={page} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="size-4 text-emerald-600" />
                    {page}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : activeTab === "credentials" ? (
          <ClientCredentialsSection
            portalToken={portalToken}
            dealId={project.id}
            accountEmail={accountEmail}
            credentials={credentials}
            copy={copy}
            locale={locale}
          />
        ) : activeTab === "corporate_email" ? (
          corporateEmails.length ? (
            <ClientCorporateEmailsSection emails={corporateEmails} copy={copy} />
          ) : (
            <EmptyState
              icon={<Mail className="size-10" />}
              title="Panel vacío"
              description="No hay correos corporativos disponibles todavía."
            />
          )
        ) : activeTab === "domain_dns" ? (
          domains.length || siteUrl ? (
            <ClientDomainSection
              domains={domains}
              siteUrl={siteUrl}
              copy={copy}
              locale={locale}
            />
          ) : (
            <EmptyState
              icon={<Globe className="size-10" />}
              title="Panel vacío"
              description="No hay información de dominio/DNS disponible todavía."
            />
          )
        ) : activeTab === "files" ? (
          resources.length ? (
            <ClientFilesSection resources={resources} copy={copy} />
          ) : (
            <EmptyState
              icon={<Folder className="size-10" />}
              title="Panel vacío"
              description="No hay archivos del proyecto compartidos todavía."
            />
          )
        ) : activeTab === "marketing_seo" ? (
          <EmptyState
            icon={<Megaphone className="size-10" />}
            title="Panel vacío"
            description="Este panel se habilitará cuando tengamos entregables de marketing y SEO."
          />
        ) : activeTab === "training" ? (
          <EmptyState
            icon={<GraduationCap className="size-10" />}
            title="Panel vacío"
            description="Aquí encontrarás material de capacitación cuando esté listo."
          />
        ) : (
          <div className="space-y-2">
            {[
              {
                title: "Chat",
                description: "Habla con nuestro equipo en tiempo real.",
                icon: <Headphones className="size-5 text-[#1E5FA8]" />,
              },
              {
                title: "Ticket",
                description: "Abre un ticket y da seguimiento.",
                icon: <FileText className="size-5 text-[#1E5FA8]" />,
              },
              {
                title: "Teléfono",
                description: "Llámanos para soporte inmediato.",
                icon: <Phone className="size-5 text-[#1E5FA8]" />,
              },
              {
                title: "Documentación",
                description: "Guías y preguntas frecuentes.",
                icon: <Globe className="size-5 text-[#1E5FA8]" />,
              },
            ].map((row) => (
              <button
                key={row.title}
                type="button"
                disabled
                className="flex w-full items-center justify-between rounded-lg bg-muted/30 px-4 py-3 text-left"
              >
                <div className="flex items-start gap-3">
                  {row.icon}
                  <div>
                    <div className="text-sm font-semibold">{row.title}</div>
                    <div className="text-sm text-muted-foreground">{row.description}</div>
                  </div>
                </div>
                <span className="text-muted-foreground">→</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
