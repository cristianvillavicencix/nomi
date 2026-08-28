/** Normalize MIME Content-ID / cid: values for matching. */
export function normalizeContentId(raw: string): string {
  let value = raw.trim().replace(/^<|>$/g, "").replace(/^cid:/i, "");
  try {
    value = decodeURIComponent(value);
  } catch {
    // keep raw when not URI-encoded
  }
  return value.toLowerCase();
}

function contentIdsMatch(stored: string, reference: string): boolean {
  const a = normalizeContentId(stored);
  const b = normalizeContentId(reference);
  if (!a || !b) return false;
  if (a === b) return true;
  // Outlook-style cid:ii_xxx vs stored ii_xxx@domain
  if (a.includes("@") && a.split("@")[0] === b) return true;
  if (b.includes("@") && b.split("@")[0] === a) return true;
  return b.startsWith(a) || a.startsWith(b);
}

/** Replace cid: image references with resolved HTTPS URLs. */
export function rewriteCidReferencesInHtml(
  html: string,
  cidToUrl: Map<string, string>,
): string {
  if (!html.trim() || cidToUrl.size === 0) return html;

  let result = html;

  result = result.replace(
    /src=(["']?)cid:([^"'\s>]+)\1/gi,
    (match, quote: string, cidValue: string) => {
      for (const [cid, url] of cidToUrl.entries()) {
        if (contentIdsMatch(cid, cidValue)) {
          return `src=${quote}${url}${quote}`;
        }
      }
      return match;
    },
  );

  result = result.replace(
    /url\((["']?)cid:([^"')]+)\1\)/gi,
    (match, quote: string, cidValue: string) => {
      for (const [cid, url] of cidToUrl.entries()) {
        if (contentIdsMatch(cid, cidValue)) {
          return `url(${quote}${url}${quote})`;
        }
      }
      return match;
    },
  );

  for (const [cid, url] of cidToUrl.entries()) {
    const bare = normalizeContentId(cid);
    for (const needle of [cid, `cid:${bare}`, `<${bare}>`]) {
      if (!needle) continue;
      result = result.split(needle).join(url);
    }
  }

  return result;
}

/** Collect bare cid: tokens from HTML for fallback attachment matching. */
export function extractCidReferencesFromHtml(html: string): string[] {
  const found = new Set<string>();
  const patterns = [
    /src=(["']?)cid:([^"'\s>]+)\1/gi,
    /url\((["']?)cid:([^"')]+)\1\)/gi,
  ];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const cid = match[2]?.trim();
      if (cid) found.add(normalizeContentId(cid));
    }
  }
  return [...found];
}
