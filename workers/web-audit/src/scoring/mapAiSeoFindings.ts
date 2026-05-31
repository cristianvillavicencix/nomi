import type { AuditFindingInput, StaticAnalysisResult } from "../types.js";

export const mapAiSeoFindings = (
  staticResult: StaticAnalysisResult,
  orderStart = 0,
): AuditFindingInput[] => {
  const crawl = staticResult.crawlFiles;
  if (!crawl) return [];

  const findings: AuditFindingInput[] = [];
  let order = orderStart;

  if (!crawl.llmsTxt.found) {
    if (crawl.llmsTxt.access === "blocked") {
      findings.push({
        category: "seo",
        severity: "importante",
        source: "static",
        source_id: "llms-txt-blocked",
        title: "llms.txt bloqueado por WAF",
        description: `No se pudo verificar /llms.txt (HTTP ${crawl.llmsTxt.fetchStatus ?? crawl.llmsTxt.status ?? 403}).`,
        recommendation:
          "Si publicaste llms.txt, permite acceso a crawlers o verifica manualmente en el navegador.",
        display_order: order++,
      });
    } else {
      findings.push({
        category: "seo",
        severity: "importante",
        source: "static",
        source_id: "missing-llms-txt",
        title: "Falta llms.txt para crawlers de IA",
        description:
          "No se encontró /llms.txt. Este archivo ayuda a ChatGPT, Claude y otros modelos a entender tu sitio más rápido.",
        recommendation:
          "Crea /llms.txt en la raíz con título, descripción breve y enlaces a páginas clave (formato Markdown).",
        display_order: order++,
      });
    }
  } else if (crawl.llmsTxt.lineCount < 3) {
    findings.push({
      category: "seo",
      severity: "nice-to-have",
      source: "static",
      source_id: "llms-txt-sparse",
      title: "llms.txt muy breve",
      description: `El archivo existe pero solo tiene ${crawl.llmsTxt.lineCount} línea(s) útil(es).`,
      recommendation:
        "Amplía llms.txt con secciones (## Servicios, ## Contacto) y enlaces markdown a páginas importantes.",
      display_order: order++,
    });
  }

  if (crawl.robots.found && !crawl.robots.allowsAiCrawlers) {
    const blocked = crawl.robots.blockedAiAgents;
    findings.push({
      category: "seo",
      severity: "importante",
      source: "static",
      source_id: "robots-blocks-ai-crawlers",
      title: "robots.txt bloquea crawlers de IA",
      description: blocked.length
        ? `Bloqueados: ${blocked.join(", ")}.${crawl.robots.blocksAllCrawlers ? " También hay Disallow: / global." : ""}`
        : "robots.txt restringe el rastreo de forma amplia.",
      recommendation:
        "Si quieres visibilidad en respuestas de IA, permite GPTBot, ClaudeBot y Google-Extended o elimina Disallow: / para esos user-agents.",
      display_order: order++,
    });
  }

  if (
    crawl.robots.found &&
    !crawl.robots.hasSitemapDirective &&
    !crawl.sitemap.found
  ) {
    findings.push({
      category: "seo",
      severity: "nice-to-have",
      source: "static",
      source_id: "robots-no-sitemap-directive",
      title: "robots.txt sin directiva Sitemap",
      description:
        "No hay línea Sitemap: en robots.txt ni sitemap.xml accesible.",
      recommendation:
        "Agrega `Sitemap: https://tudominio.com/sitemap.xml` al final de robots.txt.",
      display_order: order++,
    });
  }

  if (!crawl.securityTxt.found && crawl.securityTxt.access !== "blocked") {
    findings.push({
      category: "seo",
      severity: "nice-to-have",
      source: "static",
      source_id: "missing-security-txt",
      title: "Falta security.txt",
      description:
        "No se encontró /.well-known/security.txt ni /security.txt (RFC 9116).",
      recommendation:
        "Publica security.txt con Contact: mailto: para reportes de vulnerabilidades.",
      display_order: order++,
    });
  }

  if (!crawl.siteInfra.headers.strictTransportSecurity) {
    findings.push({
      category: "seo",
      severity: "nice-to-have",
      source: "static",
      source_id: "missing-hsts",
      title: "Sin header HSTS",
      description:
        "La respuesta HTTP no incluye Strict-Transport-Security.",
      recommendation:
        "Activa HSTS en tu CDN/hosting para forzar HTTPS en visitas recurrentes.",
      display_order: order++,
    });
  }

  if (crawl.siteInfra.headers.noindexHeader) {
    findings.push({
      category: "seo",
      severity: "critico",
      source: "static",
      source_id: "x-robots-noindex",
      title: "X-Robots-Tag: noindex en la home",
      description: `Header detectado: ${crawl.siteInfra.headers.xRobotsTag}`,
      recommendation:
        "Elimina noindex del header si quieres que la página aparezca en buscadores.",
      display_order: order++,
    });
  }

  if (crawl.siteInfra.waf.detected) {
    findings.push({
      category: "static",
      severity: "nice-to-have",
      source: "static",
      source_id: "waf-detected",
      title: `WAF / CDN detectado (${crawl.siteInfra.waf.providers.join(", ")})`,
      description:
        "Protección perimetral activa. Puede bloquear crawlers SEO y audits automáticos aunque el sitio funcione en navegador.",
      recommendation:
        "Verifica que robots.txt, sitemap y Googlebot estén permitidos en las reglas del WAF.",
      display_order: order++,
    });
  }

  return findings;
};
