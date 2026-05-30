/**
 * Static sales copy for homeowner-facing reports (PDF Phase 3).
 *
 * Language policy:
 * - commercial_message → English (end customer / homeowner)
 * - title / description / recommendation in findings → Spanish (CRM internal UI)
 *
 * Templates use {metric_value} and optional {metric_value_secondary} placeholders.
 */

export type CommercialTemplate = {
  /** Primary placeholder source (finding.metric_value). */
  template: string;
  /** Optional second value (e.g. image counts). */
  secondaryKey?: string;
};

/** Keys: metric_key, or `source:source_id` fallback (e.g. axe:color-contrast). */
export const COMMERCIAL_TEMPLATES: Record<string, CommercialTemplate> = {
  lcp_ms: {
    template:
      "Your site takes about {metric_value} to show the main content on mobile. Most visitors leave after 3 seconds — you may be losing leads before they see your work.",
  },
  performance_score: {
    template:
      "Your mobile performance score is {metric_value}/100. Slow sites feel untrustworthy and push homeowners to call your competitors first.",
  },
  seo_score: {
    template:
      "Your technical SEO score is {metric_value}/100. Fixable issues may be hiding your business from local Google searches.",
  },
  "static:missing-meta-description": {
    template:
      "Google does not have a clear description of your business, which reduces clicks from search results and makes you look less established.",
  },
  "static:missing-viewport": {
    template:
      "Your site is not configured for mobile phones. Most homeowners search for contractors on their phone — a broken mobile view sends them elsewhere.",
  },
  "static:missing-h1": {
    template:
      "Your homepage does not clearly state what you do. Homeowners decide in seconds whether you are the right contractor.",
  },
  "static:missing-sitemap": {
    template:
      "Search engines may not discover all of your service pages. That means fewer chances to show up when homeowners search locally.",
  },
  "axe:color-contrast": {
    template:
      "Text on your site is hard to read for many visitors, including older homeowners — a large share of contractor customers.",
  },
  "axe:image-alt": {
    template:
      "Project photos and logos are missing descriptions screen readers and Google need. You may be leaving trust and visibility on the table.",
  },
  "axe:label": {
    template:
      "Contact and quote forms may be difficult to use on a phone. Friction here directly costs lead submissions.",
  },
  "axe:link-name": {
    template:
      "Some buttons and links are unclear out of context. Homeowners may not know how to call, request a quote, or view your work.",
  },
  "axe:html-has-lang": {
    template:
      "Your site language is not declared for browsers and assistive tech. It is a small fix that helps accessibility and SEO.",
  },
  "axe:document-title": {
    template:
      "Your page title is missing or unclear in the browser tab. It is often the first thing homeowners see in Google results.",
  },
};

export type CommercialCopyInput = {
  severity: string;
  metric_key?: string | null;
  metric_value?: string | null;
  source?: string | null;
  source_id?: string | null;
  /** Extra values for templates (e.g. images_without_alt + total). */
  extras?: Record<string, string | number | null | undefined>;
};

const formatLcpForCopy = (raw: string) => {
  const ms = Number.parseFloat(raw.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(ms)) return raw;
  if (ms >= 1000) {
    const seconds = (ms / 1000).toFixed(1);
    return `${seconds} seconds`;
  }
  return `${Math.round(ms)} ms`;
};

const interpolate = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (_match, key: string) => values[key] ?? "");

const resolveTemplate = (input: CommercialCopyInput): CommercialTemplate | null => {
  if (input.metric_key && COMMERCIAL_TEMPLATES[input.metric_key]) {
    return COMMERCIAL_TEMPLATES[input.metric_key];
  }
  const composite = `${input.source ?? ""}:${input.source_id ?? ""}`;
  if (COMMERCIAL_TEMPLATES[composite]) {
    return COMMERCIAL_TEMPLATES[composite];
  }
  return null;
};

/**
 * Returns English homeowner-facing copy for critical findings only.
 * Returns null when no template matches or severity is not critico.
 */
export const buildCommercialMessage = (
  input: CommercialCopyInput,
): string | null => {
  if (input.severity !== "critico") return null;

  const tpl = resolveTemplate(input);
  if (!tpl) return null;

  let metricValue = input.metric_value?.trim() ?? "";
  if (input.metric_key === "lcp_ms" && metricValue) {
    metricValue = formatLcpForCopy(metricValue);
  }

  const values: Record<string, string> = {
    metric_value: metricValue,
    metric_value_secondary: "",
  };

  if (tpl.secondaryKey && input.extras?.[tpl.secondaryKey] != null) {
    values.metric_value_secondary = String(input.extras[tpl.secondaryKey]);
  }

  if (input.metric_key === "images_without_alt" && input.extras) {
    values.metric_value = String(input.extras.images_without_alt ?? metricValue);
    values.metric_value_secondary = String(input.extras.total_images ?? "");
  }

  const message = interpolate(tpl.template, values).trim();
  return message.length > 0 ? message : null;
};
