import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  Globe2,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { StaticAnalysisJson } from "@/lbs/website-monitor/audit/types";
import {
  TableCell,
  TableRow,
  WebsiteAuditTableShell,
} from "@/lbs/website-monitor/audit/WebsiteAuditTableShell";
import { cn } from "@/lib/utils";

const lengthStatusLabel: Record<string, { label: string; className: string }> =
  {
    ok: { label: "OK", className: "bg-emerald-100 text-emerald-700" },
    short: { label: "Corto", className: "bg-amber-100 text-amber-800" },
    long: { label: "Largo", className: "bg-amber-100 text-amber-800" },
    missing: { label: "Falta", className: "bg-red-100 text-red-700" },
  };

const CheckRow = ({
  ok,
  label,
  detail,
}: {
  ok: boolean;
  label: string;
  detail?: string;
}) => (
  <div className="flex items-start gap-2 rounded-lg border border-border/50 px-3 py-2 text-sm">
    {ok ? (
      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
    ) : (
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
    )}
    <div>
      <p className="font-medium">{label}</p>
      {detail ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
      ) : null}
    </div>
  </div>
);

const analysisModeLabel: Record<string, { label: string; className: string }> =
  {
    rendered: {
      label: "DOM renderizado",
      className: "bg-violet-100 text-violet-800",
    },
    embedded: {
      label: "JSON embebido",
      className: "bg-sky-100 text-sky-800",
    },
    static: {
      label: "HTML estático",
      className: "bg-muted text-muted-foreground",
    },
  };

const renderingModelLabel: Record<string, string> = {
  static: "Sitio estático / CMS",
  spa: "SPA (client-side)",
  ssr: "SSR / framework híbrido",
  hybrid: "Híbrido (shell + JS)",
};

const platformCategoryLabel: Record<string, string> = {
  cms: "CMS",
  ecommerce: "E-commerce",
  site_builder: "Site builder",
  saas: "SaaS",
  spa: "SPA",
  ssr: "SSR",
  static: "Estático",
  unknown: "Web",
};

export const WebsiteAuditSeoExpandedPanel = ({
  staticJson,
}: {
  staticJson: StaticAnalysisJson;
}) => {
  const seo = staticJson.expandedSeo;

  if (!seo) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 px-6 py-10 text-center">
        <Search className="mx-auto mb-3 size-8 text-muted-foreground/60" />
        <p className="text-sm font-medium">SEO ampliado no disponible</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Regenera el reporte con el worker actualizado para ver title/meta,
          Open Graph, JSON-LD, hreflang y más.
        </p>
      </div>
    );
  }

  const titleStatus = lengthStatusLabel[seo.titleLengthStatus ?? "missing"];
  const metaStatus =
    lengthStatusLabel[seo.metaDescriptionLengthStatus ?? "missing"];
  const arch = seo.pageArchitecture ?? staticJson.pageArchitecture;
  const modeInfo = analysisModeLabel[seo.analysisMode ?? "static"];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">SEO ampliado</h3>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Análisis on-page más allá del score Lighthouse: meta tags, datos
          estructurados, indexación e internacionalización.
        </p>
      </div>

      {seo.auditNote || arch ? (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            {seo.analysisMode ? (
              <Badge className={cn("text-[10px]", modeInfo.className)}>
                {modeInfo.label}
              </Badge>
            ) : null}
            {arch?.platformCategory ? (
              <Badge variant="outline" className="text-[10px]">
                {platformCategoryLabel[arch.platformCategory] ??
                  arch.platformCategory}
              </Badge>
            ) : null}
            {arch?.renderingModel ? (
              <Badge variant="outline" className="text-[10px]">
                {renderingModelLabel[arch.renderingModel] ??
                  arch.renderingModel}
              </Badge>
            ) : null}
            {arch?.frameworks.map((fw) => (
              <Badge key={fw} variant="secondary" className="text-[10px]">
                {fw}
              </Badge>
            ))}
          </div>
          {seo.auditNote ? (
            <p className="mt-2 text-muted-foreground">{seo.auditNote}</p>
          ) : null}
        </div>
      ) : null}

      {seo.expandedSeoScore != null ? (
        <div className="inline-flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/5 px-4 py-2">
          <span className="text-sm font-medium text-muted-foreground">
            Score SEO on-page
          </span>
          <span className="text-2xl font-bold tabular-nums text-primary">
            {seo.expandedSeoScore}
          </span>
          <span className="text-xs text-muted-foreground">
            / 100 · {seo.checksPassed}/{seo.checksTotal} checks
          </span>
        </div>
      ) : null}

      {seo.noindex ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Esta página tiene <strong>noindex</strong>
          {seo.robotsMeta ? ` (${seo.robotsMeta})` : ""}. Google no debería
          indexarla.
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Title
            </p>
            <Badge className={cn("text-[10px]", titleStatus.className)}>
              {titleStatus.label}
              {seo.titleLength != null ? ` · ${seo.titleLength} chars` : ""}
            </Badge>
          </div>
          <p className="text-sm font-medium">{staticJson.title ?? "—"}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Ideal: 30–60 caracteres
          </p>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Meta description
            </p>
            <Badge className={cn("text-[10px]", metaStatus.className)}>
              {metaStatus.label}
              {seo.metaDescriptionLength != null
                ? ` · ${seo.metaDescriptionLength} chars`
                : ""}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-3">
            {staticJson.metaDescription ?? "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Ideal: 120–160 caracteres
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <CheckRow
          ok={!seo.multipleH1 && (staticJson.h1Count ?? 0) === 1}
          label="Un solo H1"
          detail={
            seo.multipleH1
              ? `${staticJson.h1Count} H1 detectados`
              : (staticJson.h1Text ?? undefined)
          }
        />
        <CheckRow
          ok={Boolean(seo.openGraph?.complete)}
          label="Open Graph completo"
          detail={
            seo.openGraph?.missingRequired?.length
              ? `Falta: ${seo.openGraph.missingRequired.join(", ")}`
              : "og:title, description, image, url, type"
          }
        />
        <CheckRow
          ok={Boolean(seo.hasStructuredData)}
          label="Datos estructurados JSON-LD"
          detail={
            seo.structuredData?.length
              ? seo.structuredData
                  .slice(0, 4)
                  .map((item) => item.type)
                  .join(", ")
              : "No detectado"
          }
        />
        <CheckRow
          ok={Boolean(seo.htmlLang)}
          label="Idioma HTML"
          detail={seo.htmlLang ?? "Sin lang en <html>"}
        />
        <CheckRow
          ok={Boolean(staticJson.hasRobotsTxt)}
          label="robots.txt"
          detail={
            staticJson.crawlFiles?.robots.url
              ? staticJson.crawlFiles.robots.found
                ? staticJson.crawlFiles.robots.allowsAiCrawlers
                  ? "Accesible · IA permitida"
                  : "Accesible · revisar bots IA"
                : "No encontrado"
              : undefined
          }
        />
        <CheckRow
          ok={Boolean(staticJson.hasSitemap)}
          label="sitemap.xml"
          detail={
            staticJson.crawlFiles?.sitemap.urlCount != null
              ? `${staticJson.crawlFiles.sitemap.urlCount} URL(s)`
              : staticJson.crawlFiles?.sitemap.found
                ? "Encontrado"
                : undefined
          }
        />
        <CheckRow
          ok={Boolean(staticJson.crawlFiles?.llmsTxt.found)}
          label="llms.txt (IA)"
          detail={
            staticJson.crawlFiles?.llmsTxt.found
              ? `${staticJson.crawlFiles.llmsTxt.lineCount ?? 0} líneas`
              : "No encontrado"
          }
        />
      </div>

      {(seo.h1Texts?.length ?? 0) > 1 ? (
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            H1 encontrados
          </p>
          <ul className="list-disc space-y-1 pl-4 text-sm">
            {seo.h1Texts!.map((text, index) => (
              <li key={index}>{text}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {(seo.hreflang?.length ?? 0) > 0 ? (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Globe2 className="size-4" />
            hreflang ({seo.hreflang!.length})
          </p>
          <WebsiteAuditTableShell columns={["Idioma", "URL"]}>
            {seo.hreflang!.map((item) => (
              <TableRow key={`${item.lang}-${item.href}`}>
                <TableCell className="font-mono text-xs">{item.lang}</TableCell>
                <TableCell className="break-all text-xs">{item.href}</TableCell>
              </TableRow>
            ))}
          </WebsiteAuditTableShell>
        </div>
      ) : null}

      {Object.keys(seo.openGraph?.tags ?? {}).length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Open Graph</p>
          <WebsiteAuditTableShell columns={["Propiedad", "Contenido"]}>
            {Object.entries(seo.openGraph!.tags!).map(([key, value]) => (
              <TableRow key={key}>
                <TableCell className="font-mono text-xs">{key}</TableCell>
                <TableCell className="max-w-md whitespace-normal text-xs">
                  {value}
                </TableCell>
              </TableRow>
            ))}
          </WebsiteAuditTableShell>
        </div>
      ) : null}

      {(seo.structuredData?.length ?? 0) > 0 ? (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Code2 className="size-4" />
            Schema / JSON-LD
          </p>
          <WebsiteAuditTableShell columns={["Tipo", "Contexto"]}>
            {seo.structuredData!.map((item, index) => (
              <TableRow key={`${item.type}-${index}`}>
                <TableCell className="text-sm font-medium">
                  {item.type}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {item.context ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </WebsiteAuditTableShell>
        </div>
      ) : null}
    </div>
  );
};
