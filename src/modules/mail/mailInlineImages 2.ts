/** Normalize MIME Content-ID / cid: values for matching. */
export function normalizeContentId(raw: string): string {
  return raw
    .trim()
    .replace(/^<|>$/g, "")
    .replace(/^cid:/i, "")
    .toLowerCase();
}

function contentIdsMatch(stored: string, reference: string): boolean {
  const a = normalizeContentId(stored);
  const b = normalizeContentId(reference);
  if (!a || !b) return false;
  return a === b || b.startsWith(a) || a.startsWith(b);
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
