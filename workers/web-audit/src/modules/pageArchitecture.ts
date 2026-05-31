import type { DetectedTechnology } from "./detectTechnologies.js";

export type PageRenderingModel = "static" | "spa" | "ssr" | "hybrid";

export type PagePlatformCategory =
  | "cms"
  | "ecommerce"
  | "site_builder"
  | "saas"
  | "spa"
  | "ssr"
  | "static"
  | "unknown";

export type PageArchitecture = {
  renderingModel: PageRenderingModel;
  platformCategory: PagePlatformCategory;
  frameworks: string[];
  /** Cómo se evaluó el SEO on-page para este sitio. */
  seoAuditBasis: "static_html" | "rendered_dom" | "embedded_json";
  signals: string[];
};

const SPA_FRAMEWORKS = new Set([
  "React",
  "Vue.js",
  "Next.js",
  "Nuxt.js",
  "Inertia.js",
  "Svelte",
  "Angular",
  "Gatsby",
  "Remix",
  "Nuxt",
  "Astro",
  "SvelteKit",
  "Preact",
  "Ember.js",
]);

const CMS_NAMES = new Set([
  "WordPress",
  "Joomla",
  "Drupal",
  "Ghost",
  "HubSpot CMS Hub",
  "Webflow",
  "Squarespace",
  "Wix",
  "Weebly",
  "Blogger",
  "TYPO3",
  "Craft CMS",
  "Contentful",
  "Strapi",
]);

const ECOMMERCE_NAMES = new Set([
  "Shopify",
  "WooCommerce",
  "Magento",
  "BigCommerce",
  "PrestaShop",
  "OpenCart",
  "Salesforce Commerce Cloud",
]);

const SSR_MARKERS = [
  "__NEXT_DATA__",
  "__NUXT__",
  "__NUXT_DATA__",
  "data-page=",
  "data-page='",
  "window.__INITIAL_STATE__",
  "window.__remixContext",
  "__sveltekit",
  "data-sveltekit-hydrate",
  "id=\"__next\"",
  "id='__next'",
  "id=\"app\"",
  "id=\"root\"",
  "data-reactroot",
  "data-wf-page",
  "data-wf-site",
  "shopify-section",
];

type HtmlMarker = {
  test: (html: string, lower: string) => boolean;
  platform: string;
  category: PagePlatformCategory;
  signal: string;
  rendering?: PageRenderingModel;
  preferRendered?: boolean;
};

const HTML_MARKERS: HtmlMarker[] = [
  {
    test: (_h, l) => l.includes("wp-content") || l.includes("/wp-includes/"),
    platform: "WordPress",
    category: "cms",
    signal: "wordpress",
  },
  {
    test: (_h, l) => l.includes("cdn.shopify.com") || l.includes("shopify-section"),
    platform: "Shopify",
    category: "ecommerce",
    signal: "shopify",
  },
  {
    test: (_h, l) => l.includes("woocommerce") || l.includes("wc-block"),
    platform: "WooCommerce",
    category: "ecommerce",
    signal: "woocommerce",
  },
  {
    test: (_h, l) => l.includes("webflow") || l.includes("data-wf-page"),
    platform: "Webflow",
    category: "site_builder",
    signal: "webflow",
  },
  {
    test: (_h, l) => l.includes("wix.com") || l.includes("wixstatic.com"),
    platform: "Wix",
    category: "site_builder",
    signal: "wix",
    preferRendered: true,
  },
  {
    test: (_h, l) => l.includes("squarespace.com") || l.includes("static1.squarespace"),
    platform: "Squarespace",
    category: "site_builder",
    signal: "squarespace",
  },
  {
    test: (_h, l) => l.includes("joomla") || l.includes("/media/system/js/"),
    platform: "Joomla",
    category: "cms",
    signal: "joomla",
  },
  {
    test: (_h, l) => l.includes("drupal") || l.includes("sites/default/files"),
    platform: "Drupal",
    category: "cms",
    signal: "drupal",
  },
  {
    test: (_h, l) => l.includes("hubspot") || l.includes("hs-scripts.com"),
    platform: "HubSpot",
    category: "saas",
    signal: "hubspot",
  },
  {
    test: (_h, l) => l.includes("__next_data__") || l.includes("/_next/static"),
    platform: "Next.js",
    category: "ssr",
    signal: "next-data",
    rendering: "ssr",
    preferRendered: true,
  },
  {
    test: (_h, l) => l.includes("__nuxt__") || l.includes("__nuxt_data__"),
    platform: "Nuxt.js",
    category: "ssr",
    signal: "nuxt-payload",
    rendering: "ssr",
    preferRendered: true,
  },
  {
    test: (_h, l) => l.includes("data-page=") || l.includes("data-page='"),
    platform: "Inertia.js",
    category: "ssr",
    signal: "inertia-data-page",
    rendering: "ssr",
    preferRendered: true,
  },
  {
    test: (_h, l) => l.includes("react-root") || l.includes("data-reactroot"),
    platform: "React",
    category: "spa",
    signal: "react",
    preferRendered: true,
  },
  {
    test: (_h, l) => l.includes("vue-app") || l.includes("__vue__") || l.includes("data-v-"),
    platform: "Vue.js",
    category: "spa",
    signal: "vue",
    preferRendered: true,
  },
  {
    test: (_h, l) => l.includes("astro") || l.includes("data-astro-cid"),
    platform: "Astro",
    category: "ssr",
    signal: "astro",
    rendering: "hybrid",
  },
  {
    test: (_h, l) => l.includes("sveltekit") || l.includes("data-sveltekit"),
    platform: "SvelteKit",
    category: "ssr",
    signal: "sveltekit",
    rendering: "ssr",
    preferRendered: true,
  },
  {
    test: (_h, l) => l.includes("laravel") || l.includes("livewire"),
    platform: "Laravel",
    category: "ssr",
    signal: "laravel",
    rendering: "hybrid",
  },
  {
    test: (_h, l) => l.includes("django") || l.includes("csrfmiddlewaretoken"),
    platform: "Django",
    category: "cms",
    signal: "django",
  },
  {
    test: (_h, l) => l.includes("rails") || l.includes("csrf-token"),
    platform: "Ruby on Rails",
    category: "ssr",
    signal: "rails",
  },
  {
    test: (_h, l) => l.includes("asp.net") || l.includes("__viewstate"),
    platform: "ASP.NET",
    category: "ssr",
    signal: "aspnet",
  },
  {
    test: (_h, l) => l.includes("php") && l.includes(".php"),
    platform: "PHP",
    category: "static",
    signal: "php",
  },
];

export const isEmptyAppShell = (html: string) => {
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
  const withoutScripts = body.replace(/<script[\s\S]*?<\/script>/gi, "");
  const withoutNoscript = withoutScripts.replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
  const text = withoutNoscript.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length < 80;
};

const inferCategory = (
  frameworks: string[],
  renderingModel: PageRenderingModel,
): PagePlatformCategory => {
  if (frameworks.some((f) => CMS_NAMES.has(f))) return "cms";
  if (frameworks.some((f) => ECOMMERCE_NAMES.has(f))) return "ecommerce";
  if (frameworks.some((f) => ["Webflow", "Wix", "Squarespace", "Weebly"].includes(f))) {
    return "site_builder";
  }
  if (frameworks.some((f) => f === "HubSpot")) return "saas";
  if (renderingModel === "ssr") return "ssr";
  if (renderingModel === "spa") return "spa";
  if (renderingModel === "static") return "static";
  if (renderingModel === "hybrid") return "ssr";
  return "unknown";
};

export const detectPageArchitecture = (
  html: string,
  technologies: DetectedTechnology[],
): PageArchitecture => {
  const sample = html.slice(0, 300_000);
  const lower = sample.toLowerCase();
  const frameworks = new Set<string>();
  const signals: string[] = [];
  let markerRendering: PageRenderingModel | null = null;
  let forceRendered = false;
  let markerCategory: PagePlatformCategory | null = null;

  for (const tech of technologies) {
    const name = tech.name;
    if (SPA_FRAMEWORKS.has(name)) frameworks.add(name);
    if (CMS_NAMES.has(name)) frameworks.add(name);
    if (ECOMMERCE_NAMES.has(name)) frameworks.add(name);
    if (/wordpress/i.test(name)) frameworks.add("WordPress");
    if (/php/i.test(name)) frameworks.add("PHP");
    if (/laravel/i.test(name)) frameworks.add("Laravel");
    if (/shopify/i.test(name)) frameworks.add("Shopify");
    if (/webflow/i.test(name)) frameworks.add("Webflow");
    if (/angular/i.test(name)) frameworks.add("Angular");
    if (/astro/i.test(name)) frameworks.add("Astro");
  }

  for (const marker of HTML_MARKERS) {
    if (marker.test(sample, lower)) {
      frameworks.add(marker.platform);
      signals.push(marker.signal);
      if (marker.rendering) markerRendering = marker.rendering;
      if (marker.preferRendered) forceRendered = true;
      if (!markerCategory || marker.category !== "static") {
        markerCategory = marker.category;
      }
    }
  }

  for (const marker of SSR_MARKERS) {
    if (sample.includes(marker)) signals.push(marker);
  }

  const frameworkList = [...frameworks].sort();
  const hasSpaFramework = frameworkList.some((name) => SPA_FRAMEWORKS.has(name));
  const hasInertia = frameworkList.includes("Inertia.js");
  const hasNextNuxt = frameworkList.some((name) =>
    ["Next.js", "Nuxt.js", "Gatsby", "Remix", "SvelteKit", "Astro"].includes(name),
  );
  const hasCms = frameworkList.some((name) => CMS_NAMES.has(name));
  const emptyShell = isEmptyAppShell(sample);

  let renderingModel: PageRenderingModel = markerRendering ?? "static";
  if (!markerRendering) {
    if (hasNextNuxt || hasInertia) {
      renderingModel = "ssr";
    } else if (hasSpaFramework || (emptyShell && signals.length > 0)) {
      renderingModel = emptyShell ? "spa" : "hybrid";
    } else if (hasCms || frameworkList.includes("PHP")) {
      renderingModel = "static";
    }
  }

  const platformCategory =
    markerCategory ?? inferCategory(frameworkList, renderingModel);

  let seoAuditBasis: PageArchitecture["seoAuditBasis"] = "static_html";
  if (
    forceRendered ||
    renderingModel !== "static" ||
    emptyShell ||
    platformCategory === "spa" ||
    platformCategory === "site_builder"
  ) {
    seoAuditBasis = "rendered_dom";
  } else if (hasInertia || hasNextNuxt) {
    seoAuditBasis = "embedded_json";
  }

  return {
    renderingModel,
    platformCategory,
    frameworks: frameworkList,
    seoAuditBasis,
    signals: [...new Set(signals)].slice(0, 16),
  };
};

export const shouldPreferRenderedSeo = (architecture: PageArchitecture) =>
  architecture.seoAuditBasis === "rendered_dom" ||
  architecture.renderingModel === "spa" ||
  architecture.renderingModel === "ssr" ||
  architecture.renderingModel === "hybrid" ||
  architecture.platformCategory === "site_builder" ||
  architecture.platformCategory === "spa";
