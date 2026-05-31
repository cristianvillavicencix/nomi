import { useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ExternalLink,
  FileText,
  Shield,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  AiSeoChecklistJson,
  CrawlFileJson,
  CrawlFilesJson,
  DomainInfraJson,
  SiteInfraJson,
  StaticAnalysisJson,
} from "@/lbs/website-monitor/audit/types";
import { cn } from "@/lib/utils";

const pillarLabel: Record<string, string> = {
  on_page: "On-Page SEO",
  social: "Social",
  links: "Links",
  usability: "Usability",
  performance: "Performance",
};

const accessBadge = (file: CrawlFileJson) => {
  if (file.found) {
    const source =
      file.source === "browser"
        ? "navegador"
        : file.source === "merged"
          ? "fetch+navegador"
          : file.source === "fetch"
            ? "fetch"
            : null;
    return {
      className: "bg-emerald-100 text-emerald-700",
      label: file.status != null ? `HTTP ${file.status}` : "Encontrado",
      sub: source,
    };
  }
  if (file.access === "blocked") {
    return {
      className: "bg-amber-100 text-amber-800",
      label: `Bloqueado · HTTP ${file.fetchStatus ?? file.status ?? 403}`,
      sub: file.source === "browser" ? "navegador" : "fetch",
    };
  }
  return {
    className: "bg-red-100 text-red-700",
    label: "No encontrado",
    sub: null,
  };
};

const CrawlFileCard = ({
  label,
  file,
  extra,
}: {
  label: string;
  file: CrawlFileJson;
  extra?: string;
}) => {
  const [open, setOpen] = useState(false);
  const badge = accessBadge(file);

  return (
    <>
      <div className="rounded-xl border border-border/60 bg-card p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-muted-foreground" />
            <p className="text-sm font-semibold">{label}</p>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <Badge className={cn("text-[10px]", badge.className)}>
              {badge.label}
            </Badge>
            {badge.sub ? (
              <span className="text-[10px] text-muted-foreground">
                vía {badge.sub}
              </span>
            ) : null}
          </div>
        </div>

        <p className="mt-2 break-all font-mono text-xs text-muted-foreground">
          {file.url}
        </p>

        {extra ? (
          <p className="mt-2 text-xs text-muted-foreground">{extra}</p>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
            <a href={file.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-1.5 size-3.5" />
              Abrir en sitio
            </a>
          </Button>
          {file.found && file.content ? (
            <Button
              variant="secondary"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setOpen(true)}
            >
              Ver contenido
            </Button>
          ) : null}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription className="break-all font-mono text-xs">
              {file.url}
            </DialogDescription>
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-auto rounded-lg border bg-muted/40 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
            {file.content}
          </pre>
          {file.contentTruncated ? (
            <p className="text-xs text-muted-foreground">
              Contenido truncado en el reporte. Usa &quot;Abrir en sitio&quot; para
              ver el archivo completo.
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
};

const SiteInfraSection = ({ infra }: { infra: SiteInfraJson }) => {
  const headers = [
    {
      label: "HSTS",
      ok: infra.headers.strictTransportSecurity,
    },
    {
      label: "CSP",
      ok: infra.headers.contentSecurityPolicy,
    },
    {
      label: "X-Frame-Options",
      ok: Boolean(infra.headers.xFrameOptions),
    },
    {
      label: "Permissions-Policy",
      ok: infra.headers.permissionsPolicy,
    },
  ];

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-center gap-2">
        <Shield className="size-4 text-muted-foreground" />
        <p className="text-sm font-semibold">Infraestructura y headers HTTP</p>
      </div>

      {infra.waf.detected ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge className="bg-amber-100 text-amber-800 text-[10px]">
            WAF / CDN: {infra.waf.providers.join(", ")}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Puede bloquear crawlers SEO aunque el sitio cargue en navegador
          </span>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          Sin señales WAF en headers de la home
        </p>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {headers.map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-2 rounded-lg border border-border/50 px-3 py-2 text-sm"
          >
            {item.ok ? (
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="size-4 shrink-0 text-muted-foreground" />
            )}
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      {infra.headers.xRobotsTag ? (
        <p className="mt-3 font-mono text-xs text-muted-foreground">
          X-Robots-Tag: {infra.headers.xRobotsTag}
        </p>
      ) : null}

      {infra.headers.noindexHeader ? (
        <p className="mt-2 text-xs font-medium text-red-600">
          noindex detectado en header — la home puede estar excluida de buscadores
        </p>
      ) : null}
    </div>
  );
};

const DomainInfraSection = ({ domain }: { domain: DomainInfraJson }) => (
  <div className="rounded-xl border border-border/60 bg-card p-4">
    <div className="flex items-center gap-2">
      <Shield className="size-4 text-muted-foreground" />
      <p className="text-sm font-semibold">DNS, SSL y email ({domain.hostname})</p>
    </div>
    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-lg border border-border/50 px-3 py-2 text-sm">
        <p className="text-xs text-muted-foreground">SSL</p>
        <p className="font-medium">
          {domain.ssl.daysRemaining != null
            ? `${domain.ssl.daysRemaining} días`
            : "No detectado"}
        </p>
      </div>
      <div className="rounded-lg border border-border/50 px-3 py-2 text-sm">
        <p className="text-xs text-muted-foreground">SPF</p>
        <p className="font-medium">{domain.emailAuth.spf ? "OK" : "No"}</p>
      </div>
      <div className="rounded-lg border border-border/50 px-3 py-2 text-sm">
        <p className="text-xs text-muted-foreground">DMARC</p>
        <p className="font-medium">{domain.emailAuth.dmarc ? "OK" : "No"}</p>
      </div>
      <div className="rounded-lg border border-border/50 px-3 py-2 text-sm">
        <p className="text-xs text-muted-foreground">Host canónico</p>
        <p className="font-medium">{domain.hostVariant.canonicalHost}</p>
      </div>
    </div>
    {domain.dns.registrar ? (
      <p className="mt-3 text-xs text-muted-foreground">
        DNS: {domain.dns.registrar}
        {domain.dns.ip ? ` · ${domain.dns.ip}` : ""}
        {domain.dns.mx.length ? ` · ${domain.dns.mx.length} MX` : ""}
      </p>
    ) : null}
    {domain.hostVariant.note ? (
      <p className="mt-2 text-xs text-amber-700">{domain.hostVariant.note}</p>
    ) : null}
  </div>
);

const ChecklistSection = ({ checklist }: { checklist: AiSeoChecklistJson }) => {
  const byPillar = checklist.items.reduce<
    Record<string, AiSeoChecklistJson["items"]>
  >((acc, item) => {
    const key = item.pillar;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {checklist.score != null ? (
        <div className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 dark:border-violet-900 dark:bg-violet-950/40">
          <Sparkles className="size-4 text-violet-600" />
          <span className="text-sm font-medium text-muted-foreground">
            AI SEO Checklist
          </span>
          <span className="text-2xl font-bold tabular-nums text-violet-700 dark:text-violet-300">
            {checklist.score}
          </span>
          <span className="text-xs text-muted-foreground">
            / 100 · {checklist.passed}/{checklist.total} checks automáticos
          </span>
        </div>
      ) : null}

      {Object.entries(byPillar).map(([pillar, items]) => (
        <div key={pillar} className="space-y-2">
          <p className="text-sm font-semibold">{pillarLabel[pillar] ?? pillar}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-2 rounded-lg border border-border/50 px-3 py-2 text-sm"
              >
                {item.ok ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                )}
                <div>
                  <p className="font-medium">{item.label}</p>
                  {item.detail ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.detail}
                    </p>
                  ) : null}
                  {!item.ok && item.recommendation ? (
                    <p className="mt-1 text-xs text-muted-foreground/90">
                      {item.recommendation}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const robotsExtra = (crawl: CrawlFilesJson) => {
  const { robots } = crawl;
  if (!robots.found) return undefined;
  const parts: string[] = [];
  if (robots.sitemapUrls?.length) {
    parts.push(`${robots.sitemapUrls.length} Sitemap en robots`);
  }
  if (robots.blockedAiAgents?.length) {
    parts.push(`Bloquea IA: ${robots.blockedAiAgents.join(", ")}`);
  } else if (robots.allowsAiCrawlers) {
    parts.push("Permite crawlers de IA");
  }
  return parts.join(" · ") || undefined;
};

const sitemapExtra = (crawl: CrawlFilesJson) => {
  const { sitemap } = crawl;
  if (!sitemap.found) {
    if (sitemap.access === "blocked" && sitemap.candidatesTried?.length) {
      return `${sitemap.candidatesTried.length} rutas probadas (wp-sitemap, sitemap_index, etc.)`;
    }
    return undefined;
  }
  const parts: string[] = [];
  if (sitemap.urlCount != null) parts.push(`${sitemap.urlCount} URL(s)`);
  const route = sitemap.sitemapRoute ?? sitemap.source;
  if (route === "robots_txt") parts.push("URL desde robots.txt");
  if (route === "wp_sitemap") parts.push("WordPress wp-sitemap.xml");
  if (route === "sitemap_index") parts.push("sitemap index");
  return parts.join(" · ") || undefined;
};

const llmsExtra = (crawl: CrawlFilesJson) => {
  const { llmsTxt } = crawl;
  if (!llmsTxt.found) return undefined;
  const parts: string[] = [`${llmsTxt.lineCount} líneas`];
  if (llmsTxt.hasTitle) parts.push("título #");
  if (llmsTxt.hasMarkdownLinks) parts.push("enlaces markdown");
  if (llmsTxt.sectionCount) parts.push(`${llmsTxt.sectionCount} secciones`);
  return parts.join(" · ");
};

const securityExtra = (crawl: CrawlFilesJson) => {
  const sec = crawl.securityTxt;
  if (!sec?.found) return undefined;
  const parts: string[] = [];
  if (sec.hasContact) parts.push("Contact");
  if (sec.hasPolicy) parts.push("Policy");
  return parts.join(" · ") || undefined;
};

export const WebsiteAuditCrawlFilesPanel = ({
  staticJson,
}: {
  staticJson: StaticAnalysisJson;
}) => {
  const crawl = staticJson.crawlFiles;

  if (!crawl) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 px-6 py-8 text-center">
        <Bot className="mx-auto mb-3 size-8 text-muted-foreground/60" />
        <p className="text-sm font-medium">Archivos de rastreo no disponibles</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Regenera el reporte para analizar robots.txt, sitemap.xml, llms.txt,
          security.txt y el AI SEO Checklist.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-base font-semibold">Archivos críticos de rastreo</h3>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          robots.txt, sitemap, llms.txt y security.txt con estado real
          (encontrado, bloqueado por WAF o ausente) y fuente de verificación.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CrawlFileCard
          label="robots.txt"
          file={crawl.robots}
          extra={robotsExtra(crawl)}
        />
        <CrawlFileCard
          label="sitemap.xml"
          file={crawl.sitemap}
          extra={sitemapExtra(crawl)}
        />
        <CrawlFileCard
          label="llms.txt"
          file={crawl.llmsTxt}
          extra={llmsExtra(crawl)}
        />
        {crawl.securityTxt ? (
          <CrawlFileCard
            label="security.txt"
            file={crawl.securityTxt}
            extra={securityExtra(crawl)}
          />
        ) : null}
      </div>

      {crawl.siteInfra ? <SiteInfraSection infra={crawl.siteInfra} /> : null}

      {staticJson.domainInfra ? (
        <DomainInfraSection domain={staticJson.domainInfra} />
      ) : null}

      {crawl.extended ? (
        <div>
          <p className="mb-3 text-sm font-semibold">Archivos adicionales (P2)</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {crawl.extended.favicon ? (
              <CrawlFileCard label="favicon" file={crawl.extended.favicon} />
            ) : null}
            {crawl.extended.appleTouchIcon ? (
              <CrawlFileCard
                label="apple-touch-icon"
                file={crawl.extended.appleTouchIcon}
              />
            ) : null}
            {crawl.extended.webManifest ? (
              <CrawlFileCard
                label="manifest.webmanifest"
                file={crawl.extended.webManifest}
                extra={
                  crawl.extended.webManifest.hasName
                    ? "name + icons"
                    : undefined
                }
              />
            ) : null}
            {crawl.extended.rssFeed ? (
              <CrawlFileCard
                label="RSS / Atom feed"
                file={crawl.extended.rssFeed}
                extra={crawl.extended.rssFeed.feedType ?? undefined}
              />
            ) : null}
            {crawl.extended.humansTxt ? (
              <CrawlFileCard label="humans.txt" file={crawl.extended.humansTxt} />
            ) : null}
            {crawl.extended.adsTxt ? (
              <CrawlFileCard label="ads.txt" file={crawl.extended.adsTxt} />
            ) : null}
          </div>
        </div>
      ) : null}

      {staticJson.complianceSignals ? (
        <div className="rounded-xl border border-border/60 bg-card p-4 text-sm">
          <p className="font-semibold">Compliance y NAP</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="outline">
              Privacidad: {staticJson.complianceSignals.hasPrivacyLink ? "sí" : "no"}
            </Badge>
            <Badge variant="outline">
              Cookies: {staticJson.complianceSignals.hasCookieBanner ? "sí" : "no"}
            </Badge>
            <Badge variant="outline">
              Teléfono:{" "}
              {staticJson.complianceSignals.hasTelLink ||
              staticJson.complianceSignals.schemaPhone
                ? "sí"
                : "no"}
            </Badge>
            <Badge variant="outline">
              NAP schema: {staticJson.complianceSignals.napInSchema ? "sí" : "no"}
            </Badge>
          </div>
        </div>
      ) : null}

      {crawl.aiSeoChecklist ? (
        <ChecklistSection checklist={crawl.aiSeoChecklist} />
      ) : null}
    </div>
  );
};
