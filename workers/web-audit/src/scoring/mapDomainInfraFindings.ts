import type { AuditFindingInput, StaticAnalysisResult } from "../types.js";

export const mapDomainInfraFindings = (
  staticResult: StaticAnalysisResult,
  orderStart = 0,
): AuditFindingInput[] => {
  const infra = staticResult.domainInfra;
  if (!infra) return [];

  const findings: AuditFindingInput[] = [];
  let order = orderStart;

  if (infra.ssl.daysRemaining != null && infra.ssl.daysRemaining <= 14) {
    findings.push({
      category: "security",
      severity: infra.ssl.daysRemaining <= 0 ? "critico" : "importante",
      source: "static",
      source_id: "ssl-expiring",
      title:
        infra.ssl.daysRemaining <= 0
          ? "Certificado SSL expirado o no detectado"
          : "Certificado SSL próximo a vencer",
      description: infra.ssl.expiresAt
        ? `Expira ${infra.ssl.expiresAt.slice(0, 10)} (${infra.ssl.daysRemaining} días)`
        : `Quedan ${infra.ssl.daysRemaining} días`,
      recommendation: "Renueva el certificado SSL antes de que los visitantes vean avisos de seguridad.",
      display_order: order++,
    });
  }

  if (!infra.emailAuth.spf) {
    findings.push({
      category: "seo",
      severity: "nice-to-have",
      source: "static",
      source_id: "missing-spf",
      title: "Registro SPF no detectado",
      description: `Sin registro TXT v=spf1 en ${infra.hostname}`,
      recommendation:
        "Publica SPF en DNS para mejorar entregabilidad de correos del dominio.",
      display_order: order++,
    });
  }

  if (!infra.emailAuth.dmarc) {
    findings.push({
      category: "seo",
      severity: "nice-to-have",
      source: "static",
      source_id: "missing-dmarc",
      title: "Registro DMARC no detectado",
      description: `Sin registro en _dmarc.${infra.hostname}`,
      recommendation:
        "Agrega DMARC para proteger el dominio contra suplantación de email.",
      display_order: order++,
    });
  }

  if (infra.hostVariant.canonicalHost === "mixed") {
    findings.push({
      category: "seo",
      severity: "importante",
      source: "static",
      source_id: "host-variant-mismatch",
      title: "www y dominio raíz no coinciden",
      description:
        infra.hostVariant.note ??
        "Las variantes www y sin www no redirigen al mismo host canónico.",
      recommendation:
        "Elige una URL canónica (www o apex) y redirige 301 la otra variante.",
      display_order: order++,
    });
  }

  const compliance = staticResult.complianceSignals;
  if (compliance && !compliance.hasPrivacyLink) {
    findings.push({
      category: "seo",
      severity: "nice-to-have",
      source: "static",
      source_id: "missing-privacy-link",
      title: "Sin enlace a política de privacidad",
      description: "No se detectó enlace visible a privacidad en el HTML analizado.",
      recommendation:
        "Agrega enlace a política de privacidad en footer o menú legal.",
      display_order: order++,
    });
  }

  const extended = staticResult.crawlFiles?.extended;
  if (extended && !extended.rssFeed.found && extended.rssFeed.access !== "blocked") {
    const hasBlogSignals =
      /blog|news|articles|post/i.test(staticResult.finalUrl ?? staticResult.url) ||
      /wp-content|wordpress/i.test(staticResult.sourceHtml ?? "");
    if (hasBlogSignals) {
      findings.push({
        category: "seo",
        severity: "nice-to-have",
        source: "static",
        source_id: "missing-rss-feed",
        title: "Feed RSS/Atom no encontrado",
        description: "Sitio con señales de blog pero sin /feed/ ni RSS detectado.",
        recommendation: "Expón un feed RSS para suscriptores y agregadores.",
        display_order: order++,
      });
    }
  }

  return findings;
};
