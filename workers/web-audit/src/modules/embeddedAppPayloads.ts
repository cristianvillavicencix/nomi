import type { CheerioAPI } from "cheerio";

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'");

const tryParseJsonScript = (raw: string): unknown | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
};

/** SSR / SPA / CMS payloads — agnóstico al stack. */
export const parseEmbeddedJsonPayloads = ($: CheerioAPI): unknown[] => {
  const payloads: unknown[] = [];
  const seen = new Set<string>();

  const pushPayload = (raw: string | null | undefined) => {
    if (!raw) return;
    const key = raw.slice(0, 120);
    if (seen.has(key)) return;
    seen.add(key);
    const parsed = tryParseJsonScript(decodeHtmlEntities(raw));
    if (parsed != null) payloads.push(parsed);
  };

  $("[data-page]").each((_index, element) => {
    pushPayload($(element).attr("data-page"));
  });

  $("[data-props]").each((_index, element) => {
    pushPayload($(element).attr("data-props"));
  });

  const embeddedScriptIds = [
    "__NEXT_DATA__",
    "__NUXT_DATA__",
    "__NUXT__",
    "__INITIAL_STATE__",
    "__PRELOADED_STATE__",
    "__remixContext",
    "__sveltekit_data",
    "__ASTRO__",
    "__APOLLO_STATE__",
    "__REDUX_STATE__",
    "__MOBX_STATE__",
    "__Gatsby",
    "__GATSBY_STATIC_QUERY_VALUES__",
    "shopify-features",
    "web-pixels-manager-setup",
  ];
  for (const id of embeddedScriptIds) {
    pushPayload($(`script#${id}`).html());
    pushPayload($(`script[id='${id}']`).html());
  }

  $('script[type="application/json"]').each((_index, element) => {
    pushPayload($(element).html());
  });

  $('script[type="application/ld+json"]').each((_index, element) => {
    pushPayload($(element).html());
  });

  $("script:not([src])").each((_index, element) => {
    const raw = $(element).html()?.trim() ?? "";
    if (!raw.startsWith("{") && !raw.startsWith("[")) return;
    if (raw.length > 500_000) return;
    pushPayload(raw);
  });

  return payloads;
};
