import { config } from "../config.js";
import type { Page } from "puppeteer-core";
import {
  resolveCrawlResource,
  type CrawlFileFetcher,
  type CrawlResourceAccess,
  type CrawlResourceSource,
} from "./crawlResourceResolver.js";
import {
  mergeExtendedCrawlFiles,
} from "./extendedCrawlFiles.js";
import {
  analyzeSiteInfra,
  type SiteInfraAnalysis,
} from "./siteInfraAnalysis.js";

export type { CrawlFileFetcher, CrawlResourceAccess, CrawlResourceSource };
export type { SiteInfraAnalysis };

/** Crawlers de IA frecuentes (AI SEO Checklist). */
export const AI_CRAWLER_AGENTS = [
  "GPTBot",
  "ClaudeBot",
  "anthropic-ai",
  "Google-Extended",
  "CCBot",
  "Bytespider",
  "PerplexityBot",
  "Amazonbot",
  "Applebot-Extended",
  "cohere-ai",
  "meta-externalagent",
  "FacebookBot",
] as const;

export type CrawlFileSnapshot = {
  url: string;
  status: number | null;
  fetchStatus?: number | null;
  browserStatus?: number | null;
  access: CrawlResourceAccess;
  source: CrawlResourceSource;
  content: string | null;
  contentTruncated: boolean;
  found: boolean;
};

export type SecurityTxtAnalysis = CrawlFileSnapshot & {
  found: boolean;
  hasContact: boolean;
  hasPolicy: boolean;
};

export type RobotsTxtAnalysis = CrawlFileSnapshot & {
  sitemapUrls: string[];
  blocksAllCrawlers: boolean;
  blockedAiAgents: string[];
  allowsAiCrawlers: boolean;
  hasSitemapDirective: boolean;
};

export type SitemapAnalysis = CrawlFileSnapshot & {
  urlCount: number | null;
  sitemapRoute: "default" | "robots_txt" | "wp_sitemap" | "sitemap_index" | "none";
  candidatesTried?: string[];
};

export type LlmsTxtAnalysis = CrawlFileSnapshot & {
  lineCount: number;
  hasTitle: boolean;
  hasDescription: boolean;
  hasMarkdownLinks: boolean;
  mentionsSitemap: boolean;
  sectionCount: number;
};

export type AiSeoChecklistItem = {
  id: string;
  pillar: "on_page" | "social" | "links" | "usability" | "performance";
  label: string;
  ok: boolean;
  detail?: string | null;
  recommendation?: string | null;
  manual?: boolean;
};

export type AiSeoChecklistResult = {
  passed: number;
  total: number;
  score: number | null;
  items: AiSeoChecklistItem[];
};

export type CrawlFilesAnalysisResult = {
  siteOrigin: string;
  robots: RobotsTxtAnalysis;
  sitemap: SitemapAnalysis;
  llmsTxt: LlmsTxtAnalysis;
  securityTxt: SecurityTxtAnalysis;
  siteInfra: SiteInfraAnalysis;
  extended?: import("./extendedCrawlFiles.js").ExtendedCrawlFiles;
  aiSeoChecklist: AiSeoChecklistResult;
};

export type CrawlFilesFetchers =
  | CrawlFileFetcher
  | {
      datacenter?: CrawlFileFetcher;
      browser?: CrawlFileFetcher;
    };

const MAX_CONTENT_CHARS = 12_000;
const MAX_SITEMAP_PREVIEW = 4_000;

const emptySnapshot = (url: string): CrawlFileSnapshot => ({
  url,
  status: null,
  fetchStatus: null,
  browserStatus: null,
  access: "missing",
  source: "fetch",
  content: null,
  contentTruncated: false,
  found: false,
});

const snapshotFromResolved = (
  resolved: Awaited<ReturnType<typeof resolveCrawlResource>>,
  maxChars = MAX_CONTENT_CHARS,
): CrawlFileSnapshot => {
  const { text, truncated } = resolved.content
    ? truncate(resolved.content, maxChars)
    : { text: null, truncated: false };
  return {
    url: resolved.url,
    status: resolved.status,
    fetchStatus: resolved.fetchStatus,
    browserStatus: resolved.browserStatus,
    access: resolved.access,
    source: resolved.source,
    content: text,
    contentTruncated: truncated,
    found: resolved.found,
  };
};

const normalizeFetchers = (
  fetchers: CrawlFilesFetchers,
): { datacenter?: CrawlFileFetcher; browser?: CrawlFileFetcher } =>
  typeof fetchers === "function" ? { datacenter: fetchers } : fetchers;

const isRobotsContent = (text: string) =>
  /user-agent|disallow|allow|sitemap/i.test(text) && text.trim().length >= 3;

const isSitemapContent = (text: string) =>
  /<urlset|<sitemapindex|<loc[\s>]/i.test(text);

const isLlmsContent = (text: string) => {
  const t = text.trim();
  if (t.startsWith("<!DOCTYPE") || t.startsWith("<html")) return false;
  return t.length >= 3;
};

const isSecurityTxtContent = (text: string) => {
  const t = text.trim();
  if (t.startsWith("<!DOCTYPE") || t.startsWith("<html")) return false;
  return /contact|policy|encryption|canonical|preferred-languages/i.test(t) || t.includes(":");
};

const parseSecurityTxt = (content: string) => ({
  hasContact: /^Contact:/im.test(content),
  hasPolicy: /^Policy:/im.test(content),
});

const sitemapCandidateUrls = (origin: string, robotsUrls: string[]) => {
  const candidates = [
    ...robotsUrls,
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/sitemap-index.xml`,
    `${origin}/wp-sitemap.xml`,
  ];
  return [...new Set(candidates)];
};

const sitemapRouteFromUrl = (
  url: string,
  origin: string,
  robotsUrls: string[],
): SitemapAnalysis["sitemapRoute"] => {
  if (robotsUrls.includes(url)) return "robots_txt";
  if (url.includes("wp-sitemap")) return "wp_sitemap";
  if (url.includes("sitemap_index") || url.includes("sitemap-index")) {
    return "sitemap_index";
  }
  if (url === `${origin}/sitemap.xml`) return "default";
  return "default";
};

const truncate = (text: string, max = MAX_CONTENT_CHARS) => {
  if (text.length <= max) {
    return { text, truncated: false };
  }
  return { text: `${text.slice(0, max)}\n\n… (contenido truncado)`, truncated: true };
};

const fetchTextResource: CrawlFileFetcher = async (url, signal) => {
  try {
    const response = await fetch(url, {
      signal,
      redirect: "follow",
      headers: {
        "User-Agent": config.userAgent,
        Accept:
          "text/plain,text/html,application/xml,text/xml,application/xhtml+xml,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,es;q=0.8",
        "Cache-Control": "no-cache",
      },
    });
    const text = await response.text();
    return { status: response.status, text };
  } catch {
    return null;
  }
};

/** Fetch desde el contexto del navegador (evita WAF que bloquea datacenter). */
export const createBrowserCrawlFileFetcher = (page: Page): CrawlFileFetcher => {
  return async (url, signal) => {
    if (signal.aborted) return null;
    const currentUrl = page.url();

    try {
      const viaFetch = await page.evaluate(async (targetUrl) => {
        try {
          const res = await fetch(targetUrl, { credentials: "same-origin" });
          const text = await res.text();
          return { status: res.status, text };
        } catch {
          return null;
        }
      }, url);

      if (viaFetch && viaFetch.status >= 200 && viaFetch.status < 400 && viaFetch.text.trim()) {
        return viaFetch;
      }

      if (currentUrl === "about:blank") return viaFetch;

      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 20_000,
      });
      if (!response) return viaFetch;

      const text = await page.evaluate(() => {
        const pre = document.querySelector("pre");
        if (pre?.textContent?.trim()) return pre.textContent;
        const body = document.body?.innerText?.trim();
        if (body) return body;
        return document.documentElement?.outerHTML ?? "";
      });

      return text.trim()
        ? { status: response.status(), text }
        : viaFetch;
    } catch {
      return null;
    } finally {
      if (currentUrl && currentUrl.startsWith("http") && page.url() !== currentUrl) {
        await page
          .goto(currentUrl, { waitUntil: "domcontentloaded", timeout: 25_000 })
          .catch(() => undefined);
      }
    }
  };
};

export const mergeCrawlFilesPreferBrowser = (
  current: CrawlFilesAnalysisResult | null | undefined,
  browser: CrawlFilesAnalysisResult,
): CrawlFilesAnalysisResult => {
  const pickSnap = <T extends CrawlFileSnapshot>(a: T, b: T): T => {
    if (b.found) return { ...b, fetchStatus: a.fetchStatus ?? b.fetchStatus, source: a.found && b.found ? "merged" : b.source };
    if (a.found) return a;
    if (b.access === "blocked" || a.access === "blocked") {
      return { ...b, fetchStatus: a.fetchStatus ?? b.fetchStatus, browserStatus: b.browserStatus ?? a.browserStatus, access: "blocked" as const };
    }
    return b.status != null ? b : a;
  };

  const robots = {
    ...pickSnap(current?.robots ?? browser.robots, browser.robots),
    sitemapUrls: browser.robots.sitemapUrls.length
      ? browser.robots.sitemapUrls
      : current?.robots.sitemapUrls ?? [],
    blocksAllCrawlers: browser.robots.found ? browser.robots.blocksAllCrawlers : current?.robots.blocksAllCrawlers ?? false,
    blockedAiAgents: browser.robots.found ? browser.robots.blockedAiAgents : current?.robots.blockedAiAgents ?? [],
    allowsAiCrawlers: browser.robots.found ? browser.robots.allowsAiCrawlers : current?.robots.allowsAiCrawlers ?? false,
    hasSitemapDirective: browser.robots.hasSitemapDirective || Boolean(current?.robots.hasSitemapDirective),
  };

  const sitemap = {
    ...pickSnap(current?.sitemap ?? browser.sitemap, browser.sitemap),
    urlCount: browser.sitemap.found ? browser.sitemap.urlCount : current?.sitemap.urlCount ?? null,
    sitemapRoute: browser.sitemap.found ? browser.sitemap.sitemapRoute : current?.sitemap.sitemapRoute ?? "none",
    candidatesTried: browser.sitemap.candidatesTried ?? current?.sitemap.candidatesTried,
  };

  const llmsTxt = {
    ...pickSnap(current?.llmsTxt ?? browser.llmsTxt, browser.llmsTxt),
    lineCount: browser.llmsTxt.found ? browser.llmsTxt.lineCount : current?.llmsTxt.lineCount ?? 0,
    hasTitle: browser.llmsTxt.hasTitle || Boolean(current?.llmsTxt.hasTitle),
    hasDescription: browser.llmsTxt.hasDescription || Boolean(current?.llmsTxt.hasDescription),
    hasMarkdownLinks: browser.llmsTxt.hasMarkdownLinks || Boolean(current?.llmsTxt.hasMarkdownLinks),
    mentionsSitemap: browser.llmsTxt.mentionsSitemap || Boolean(current?.llmsTxt.mentionsSitemap),
    sectionCount: browser.llmsTxt.sectionCount || current?.llmsTxt.sectionCount || 0,
  };

  const securityTxt = {
    ...pickSnap(current?.securityTxt ?? browser.securityTxt, browser.securityTxt),
    hasContact: browser.securityTxt.hasContact || Boolean(current?.securityTxt.hasContact),
    hasPolicy: browser.securityTxt.hasPolicy || Boolean(current?.securityTxt.hasPolicy),
  };

  const siteInfra = mergeSiteInfra(current?.siteInfra, browser.siteInfra);
  const extended = mergeExtendedCrawlFiles(current?.extended, browser.extended);

  const merged: CrawlFilesAnalysisResult = {
    siteOrigin: browser.siteOrigin || current?.siteOrigin || "",
    robots,
    sitemap,
    llmsTxt,
    securityTxt,
    siteInfra,
    extended,
    aiSeoChecklist: current?.aiSeoChecklist ?? browser.aiSeoChecklist,
  };

  return merged;
};

const mergeSiteInfra = (
  current: SiteInfraAnalysis | undefined,
  browser: SiteInfraAnalysis,
): SiteInfraAnalysis => {
  const a = current ?? browser;
  const b = browser;
  const providers = new Set([...a.waf.providers, ...b.waf.providers]);
  const signals = new Set([...a.waf.signals, ...b.waf.signals]);

  return {
    waf: {
      detected: providers.size > 0,
      providers: [...providers],
      signals: [...signals],
    },
    headers: {
      strictTransportSecurity:
        a.headers.strictTransportSecurity || b.headers.strictTransportSecurity,
      contentSecurityPolicy:
        a.headers.contentSecurityPolicy || b.headers.contentSecurityPolicy,
      xRobotsTag: a.headers.xRobotsTag ?? b.headers.xRobotsTag,
      xFrameOptions: a.headers.xFrameOptions ?? b.headers.xFrameOptions,
      permissionsPolicy:
        a.headers.permissionsPolicy || b.headers.permissionsPolicy,
      noindexHeader: a.headers.noindexHeader || b.headers.noindexHeader,
    },
    headerSample: { ...a.headerSample, ...b.headerSample },
  };
};

export const applyCrawlFilesToStatic = (
  staticResult: { crawlFiles?: CrawlFilesAnalysisResult | null; hasRobotsTxt: boolean; robotsTxtStatus: number | null; hasSitemap: boolean; sitemapStatus: number | null },
  crawl: CrawlFilesAnalysisResult,
) => {
  staticResult.crawlFiles = crawl;
  staticResult.hasRobotsTxt = crawl.robots.found;
  staticResult.robotsTxtStatus = crawl.robots.status;
  staticResult.hasSitemap = crawl.sitemap.found;
  staticResult.sitemapStatus = crawl.sitemap.status;
};

const normalizeAgent = (value: string) => value.trim().toLowerCase();

const parseRobotsTxt = (content: string) => {
  const lines = content.split(/\r?\n/);
  const sitemapUrls: string[] = [];
  const blockedAiAgents = new Set<string>();
  let blocksAll = false;

  type Block = { agents: string[]; disallows: string[]; allows: string[] };
  const blocks: Block[] = [];
  let current: Block | null = null;

  for (const rawLine of lines) {
    const line = rawLine.split("#")[0]?.trim() ?? "";
    if (!line) continue;

    const sitemapMatch = line.match(/^sitemap:\s*(.+)$/i);
    if (sitemapMatch?.[1]) {
      sitemapUrls.push(sitemapMatch[1].trim());
      continue;
    }

    const uaMatch = line.match(/^user-agent:\s*(.+)$/i);
    if (uaMatch?.[1]) {
      if (!current || current.agents.length > 0) {
        current = { agents: [], disallows: [], allows: [] };
        blocks.push(current);
      }
      current.agents.push(normalizeAgent(uaMatch[1]));
      continue;
    }

    const disallowMatch = line.match(/^disallow:\s*(.*)$/i);
    if (disallowMatch && current) {
      current.disallows.push((disallowMatch[1] ?? "").trim());
      continue;
    }

    const allowMatch = line.match(/^allow:\s*(.*)$/i);
    if (allowMatch && current) {
      current.allows.push((allowMatch[1] ?? "").trim());
    }
  }

  const agentBlocked = (agent: string, block: Block) => {
    const normalized = normalizeAgent(agent);
    const applies =
      block.agents.includes("*") ||
      block.agents.some((a) => a === normalized || normalized.includes(a));
    if (!applies) return false;

    const rootDisallow = block.disallows.some(
      (rule) => rule === "/" || rule === "/*",
    );
    if (rootDisallow && block.allows.length === 0) return true;

    if (block.disallows.includes("/") && !block.allows.some((a) => a === "/")) {
      return true;
    }

    return false;
  };

  for (const block of blocks) {
    if (block.agents.includes("*") && agentBlocked("*", block)) {
      blocksAll = true;
    }
    for (const aiAgent of AI_CRAWLER_AGENTS) {
      if (agentBlocked(aiAgent, block)) {
        blockedAiAgents.add(aiAgent);
      }
    }
  }

  return {
    sitemapUrls: [...new Set(sitemapUrls)],
    blocksAllCrawlers: blocksAll,
    blockedAiAgents: [...blockedAiAgents],
    allowsAiCrawlers: blockedAiAgents.size === 0 && !blocksAll,
    hasSitemapDirective: sitemapUrls.length > 0,
  };
};

const countSitemapUrls = (xml: string) => {
  const locMatches = xml.match(/<loc[\s>]/gi)?.length ?? 0;
  const urlMatches = xml.match(/<url[\s>]/gi)?.length ?? 0;
  return Math.max(locMatches, urlMatches) || null;
};

const analyzeLlmsContent = (content: string) => {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const hasTitle = /^#\s+.+/m.test(content);
  const hasDescription = /^>\s+.+/m.test(content);
  const hasMarkdownLinks = /\[.+?\]\(.+?\)/.test(content);
  const mentionsSitemap = /sitemap|llms\.txt|robots\.txt/i.test(content);
  const sectionCount = (content.match(/^##\s+/gm) ?? []).length;

  return {
    lineCount: lines.length,
    hasTitle,
    hasDescription,
    hasMarkdownLinks,
    mentionsSitemap,
    sectionCount,
  };
};

export const buildAiSeoChecklist = (params: {
  robots: RobotsTxtAnalysis;
  sitemap: SitemapAnalysis;
  llmsTxt: LlmsTxtAnalysis;
  securityTxt: SecurityTxtAnalysis;
  siteInfra: SiteInfraAnalysis;
  extended?: import("./extendedCrawlFiles.js").ExtendedCrawlFiles;
  complianceSignals?: import("./complianceAnalysis.js").ComplianceSignals;
  hasStructuredData: boolean;
  hasLocalBusinessSchema: boolean;
  openGraphComplete: boolean;
  titleOk: boolean;
  metaOk: boolean;
  hasH1: boolean;
  socialLinkCount: number;
  hasViewport: boolean;
  brokenLinkCount: number;
  imagesWithoutAlt: number;
}): AiSeoChecklistResult => {
  const accessLabel = (snap: CrawlFileSnapshot) => {
    if (snap.found) return `OK · ${snap.source === "browser" ? "navegador" : snap.source === "merged" ? "fetch+navegador" : "fetch"}`;
    if (snap.access === "blocked") return `Bloqueado (HTTP ${snap.fetchStatus ?? snap.status ?? "403"})`;
    return "No encontrado";
  };

  const items: AiSeoChecklistItem[] = [
    {
      id: "structured-data",
      pillar: "on_page",
      label: "Datos estructurados (schema)",
      ok: params.hasStructuredData,
      detail: params.hasLocalBusinessSchema
        ? "LocalBusiness u otro schema detectado"
        : params.hasStructuredData
          ? "JSON-LD presente"
          : "Sin JSON-LD",
      recommendation:
        "Agrega LocalBusiness u Organization schema según el tipo de negocio.",
    },
    {
      id: "open-graph",
      pillar: "on_page",
      label: "Open Graph para compartir",
      ok: params.openGraphComplete,
      detail: params.openGraphComplete ? "OG completo" : "OG incompleto",
      recommendation:
        "Completa og:title, og:description, og:image y og:url.",
    },
    {
      id: "title-meta",
      pillar: "on_page",
      label: "Title y meta description",
      ok: params.titleOk && params.metaOk,
      detail: `Title ${params.titleOk ? "OK" : "revisar"} · Meta ${params.metaOk ? "OK" : "revisar"}`,
      recommendation:
        "Responde preguntas del cliente en párrafos claros con title y meta orientados a conversión.",
    },
    {
      id: "social-profiles",
      pillar: "social",
      label: "Perfiles sociales enlazados",
      ok: params.socialLinkCount >= 2,
      detail: `${params.socialLinkCount} red(es) detectada(s)`,
      recommendation:
        "Usa palabras clave de marca consistentes en bios y enlaza perfiles desde el sitio.",
    },
    {
      id: "internal-links",
      pillar: "links",
      label: "Enlaces internos sin roturas",
      ok: params.brokenLinkCount === 0,
      detail:
        params.brokenLinkCount === 0
          ? "Sin enlaces rotos verificados"
          : `${params.brokenLinkCount} enlace(s) roto(s)`,
      recommendation:
        "Menciones en medios locales y directorios del sector requieren outreach manual.",
      manual: params.brokenLinkCount === 0,
    },
    {
      id: "headings-viewport",
      pillar: "usability",
      label: "Encabezados claros y viewport móvil",
      ok: params.hasH1 && params.hasViewport,
      detail: `${params.hasH1 ? "H1 presente" : "Sin H1"} · ${params.hasViewport ? "viewport OK" : "sin viewport"}`,
      recommendation:
        "Organiza contenido con H1/H2 claros y verifica que los botones sean fáciles de tocar en móvil.",
    },
    {
      id: "llms-txt",
      pillar: "performance",
      label: "Archivo llms.txt para crawlers de IA",
      ok: params.llmsTxt.found && params.llmsTxt.lineCount >= 3,
      detail: params.llmsTxt.found
        ? `${params.llmsTxt.lineCount} líneas`
        : "No encontrado en /llms.txt",
      recommendation:
        "Publica /llms.txt con resumen del sitio, secciones y enlaces clave para modelos de IA.",
    },
    {
      id: "robots-ai",
      pillar: "performance",
      label: "robots.txt permite crawlers de IA",
      ok: params.robots.found && params.robots.allowsAiCrawlers,
      detail: params.robots.found
        ? params.robots.blockedAiAgents.length
          ? `Bloquea: ${params.robots.blockedAiAgents.join(", ")} · ${accessLabel(params.robots)}`
          : `${accessLabel(params.robots)} · Sin bloqueo a bots IA`
        : params.robots.access === "blocked"
          ? "Fetch bloqueado por WAF; no verificado"
          : "robots.txt no encontrado",
      recommendation:
        "Revisa robots.txt y no bloquees GPTBot, ClaudeBot, Google-Extended u otros si quieres visibilidad en IA.",
    },
    {
      id: "sitemap",
      pillar: "performance",
      label: "Sitemap XML accesible",
      ok: params.sitemap.found,
      detail: params.sitemap.found
        ? `${params.sitemap.urlCount != null ? `${params.sitemap.urlCount} URL(s) · ` : ""}${accessLabel(params.sitemap)}${params.sitemap.sitemapRoute !== "default" ? ` · ${params.sitemap.sitemapRoute}` : ""}`
        : params.sitemap.access === "blocked"
          ? "Bloqueado por WAF en rutas estándar"
          : `No encontrado${params.sitemap.candidatesTried?.length ? ` (${params.sitemap.candidatesTried.length} rutas probadas)` : ""}`,
      recommendation:
        "Genera sitemap.xml (o wp-sitemap.xml) y decláralo en robots.txt y Search Console.",
    },
    {
      id: "security-txt",
      pillar: "performance",
      label: "security.txt (RFC 9116)",
      ok: params.securityTxt.found,
      detail: params.securityTxt.found
        ? `${accessLabel(params.securityTxt)}${params.securityTxt.hasContact ? " · Contact" : ""}`
        : "No encontrado en /.well-known/security.txt",
      recommendation:
        "Publica security.txt con contacto de seguridad para auditorías y reportes responsables.",
    },
    {
      id: "hsts",
      pillar: "performance",
      label: "HSTS (Strict-Transport-Security)",
      ok: params.siteInfra.headers.strictTransportSecurity,
      detail: params.siteInfra.headers.strictTransportSecurity
        ? "Header presente"
        : "Sin HSTS en respuesta HTTP",
      recommendation: "Activa HSTS en el hosting para forzar HTTPS.",
    },
    {
      id: "waf-aware",
      pillar: "performance",
      label: "WAF / bot protection detectado",
      ok: !params.siteInfra.waf.detected,
      detail: params.siteInfra.waf.detected
        ? `${params.siteInfra.waf.providers.join(", ")} · puede bloquear crawlers SEO`
        : "Sin señales WAF en headers",
      recommendation:
        "Si usas Cloudflare/Sucuri/Wordfence, permite Googlebot y valida que robots/sitemap sean accesibles.",
      manual: !params.siteInfra.waf.detected,
    },
    {
      id: "privacy-link",
      pillar: "usability",
      label: "Enlace a política de privacidad",
      ok: params.complianceSignals?.hasPrivacyLink ?? false,
      detail: params.complianceSignals?.hasPrivacyLink
        ? `${params.complianceSignals.privacyUrls.length} enlace(s) detectado(s)`
        : "Sin enlace visible a privacidad",
      recommendation:
        "Agrega un enlace claro a la política de privacidad en footer o menú legal.",
    },
    {
      id: "cookie-banner",
      pillar: "usability",
      label: "Banner / aviso de cookies",
      ok: params.complianceSignals?.hasCookieBanner ?? false,
      detail: params.complianceSignals?.hasCookieBanner
        ? "Señales de consentimiento detectadas"
        : "Sin banner de cookies visible",
      recommendation:
        "Implementa aviso de cookies si tienes visitantes en UE/California.",
      manual: !params.complianceSignals?.hasCookieBanner,
    },
    {
      id: "nap-schema",
      pillar: "on_page",
      label: "NAP en schema (teléfono/dirección)",
      ok: params.complianceSignals?.napInSchema ?? false,
      detail: params.complianceSignals?.napInSchema
        ? [
            params.complianceSignals.schemaPhone,
            params.complianceSignals.schemaAddress,
          ]
            .filter(Boolean)
            .join(" · ") || "LocalBusiness/Organization con NAP"
        : "Sin teléfono/dirección en JSON-LD",
      recommendation:
        "Incluye telephone y address en schema LocalBusiness para SEO local.",
    },
    {
      id: "web-manifest",
      pillar: "performance",
      label: "Web App Manifest",
      ok: Boolean(params.extended?.webManifest.found),
      detail: params.extended?.webManifest.found
        ? `${params.extended.webManifest.hasName ? "name · " : ""}${params.extended.webManifest.hasIcons ? "icons" : "sin icons"}`
        : "No encontrado",
      recommendation: "Publica manifest.webmanifest para PWA e iconos móviles.",
    },
    {
      id: "favicon",
      pillar: "performance",
      label: "Favicon accesible",
      ok: Boolean(params.extended?.favicon.found),
      detail: params.extended?.favicon.found
        ? "favicon.ico o link rel=icon OK"
        : "No verificado",
      recommendation: "Agrega favicon.ico y link rel=icon en el head.",
    },
    {
      id: "image-alt",
      pillar: "performance",
      label: "Imágenes con texto alternativo",
      ok: params.imagesWithoutAlt === 0,
      detail:
        params.imagesWithoutAlt === 0
          ? "Todas con alt"
          : `${params.imagesWithoutAlt} sin alt`,
      recommendation:
        "Comprime imágenes pesadas y agrega alt descriptivo para búsqueda visual.",
    },
  ];

  const autoItems = items.filter((item) => !item.manual);
  const passed = autoItems.filter((item) => item.ok).length;
  const total = autoItems.length;

  return {
    passed,
    total,
    score: total > 0 ? Math.round((passed / total) * 100) : null,
    items,
  };
};

export const analyzeCrawlFiles = async (
  origin: string,
  signal: AbortSignal,
  seoContext: {
    hasStructuredData: boolean;
    structuredDataTypes: string[];
    openGraphComplete: boolean;
    titleOk: boolean;
    metaOk: boolean;
    hasH1: boolean;
    socialLinkCount: number;
    hasViewport: boolean;
    brokenLinkCount: number;
    imagesWithoutAlt: number;
  },
  fetchers: CrawlFilesFetchers = fetchTextResource,
  homeHeaders: Record<string, string> = {},
): Promise<CrawlFilesAnalysisResult> => {
  const resolvedFetchers = normalizeFetchers(fetchers);
  const robotsUrl = `${origin}/robots.txt`;
  const llmsUrl = `${origin}/llms.txt`;
  const securityUrls = [
    `${origin}/.well-known/security.txt`,
    `${origin}/security.txt`,
  ];

  const robotsResolved = await resolveCrawlResource(
    robotsUrl,
    signal,
    resolvedFetchers,
    isRobotsContent,
  );

  let robots: RobotsTxtAnalysis = {
    ...snapshotFromResolved(robotsResolved),
    sitemapUrls: [],
    blocksAllCrawlers: false,
    blockedAiAgents: [],
    allowsAiCrawlers: false,
    hasSitemapDirective: false,
  };

  if (robots.found && robots.content) {
    const parsed = parseRobotsTxt(robots.content);
    robots = { ...robots, ...parsed };
  }

  const sitemapCandidates = sitemapCandidateUrls(origin, robots.sitemapUrls);
  let sitemap: SitemapAnalysis = {
    ...emptySnapshot(`${origin}/sitemap.xml`),
    urlCount: null,
    sitemapRoute: "none",
    candidatesTried: sitemapCandidates,
  };

  for (const candidate of sitemapCandidates) {
    const resolved = await resolveCrawlResource(
      candidate,
      signal,
      resolvedFetchers,
      isSitemapContent,
    );
    if (resolved.found && resolved.content) {
      const { text, truncated } = truncate(resolved.content, MAX_SITEMAP_PREVIEW);
      sitemap = {
        ...snapshotFromResolved(resolved, MAX_SITEMAP_PREVIEW),
        content: text,
        contentTruncated: truncated,
        urlCount: countSitemapUrls(resolved.content),
        sitemapRoute: sitemapRouteFromUrl(candidate, origin, robots.sitemapUrls),
        candidatesTried: sitemapCandidates,
      };
      break;
    }
  }

  const llmsResolved = await resolveCrawlResource(
    llmsUrl,
    signal,
    resolvedFetchers,
    isLlmsContent,
  );
  let llmsTxt: LlmsTxtAnalysis = {
    ...snapshotFromResolved(llmsResolved),
    lineCount: 0,
    hasTitle: false,
    hasDescription: false,
    hasMarkdownLinks: false,
    mentionsSitemap: false,
    sectionCount: 0,
  };
  if (llmsTxt.found && llmsTxt.content) {
    llmsTxt = { ...llmsTxt, ...analyzeLlmsContent(llmsTxt.content) };
  }

  let securityTxt: SecurityTxtAnalysis = {
    ...emptySnapshot(securityUrls[0]!),
    hasContact: false,
    hasPolicy: false,
  };
  for (const secUrl of securityUrls) {
    const resolved = await resolveCrawlResource(
      secUrl,
      signal,
      resolvedFetchers,
      isSecurityTxtContent,
    );
    if (resolved.found && resolved.content) {
      securityTxt = {
        ...snapshotFromResolved(resolved),
        ...parseSecurityTxt(resolved.content),
      };
      break;
    }
    if (resolved.access === "blocked" && securityTxt.access === "missing") {
      securityTxt = {
        ...snapshotFromResolved(resolved),
        hasContact: false,
        hasPolicy: false,
      };
    }
  }

  const siteInfra = analyzeSiteInfra(homeHeaders);

  const hasLocalBusinessSchema = seoContext.structuredDataTypes.some((type) =>
    /localbusiness|organization|website/i.test(type),
  );

  const aiSeoChecklist = buildAiSeoChecklist({
    robots,
    sitemap,
    llmsTxt,
    securityTxt,
    siteInfra,
    extended: undefined,
    complianceSignals: undefined,
    hasStructuredData: seoContext.hasStructuredData,
    hasLocalBusinessSchema,
    openGraphComplete: seoContext.openGraphComplete,
    titleOk: seoContext.titleOk,
    metaOk: seoContext.metaOk,
    hasH1: seoContext.hasH1,
    socialLinkCount: seoContext.socialLinkCount,
    hasViewport: seoContext.hasViewport,
    brokenLinkCount: seoContext.brokenLinkCount,
    imagesWithoutAlt: seoContext.imagesWithoutAlt,
  });

  return {
    siteOrigin: origin,
    robots,
    sitemap,
    llmsTxt,
    securityTxt,
    siteInfra,
    aiSeoChecklist,
  };
};
