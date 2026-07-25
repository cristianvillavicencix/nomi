/** Remove inline email images that still reference Content-IDs (cid:…). */
export const stripCidFromHtml = (html: string | null | undefined) => {
  if (!html?.trim()) return html?.trim() ?? "";

  return html
    .replace(/<img\b[^>]*\bsrc\s*=\s*["']cid:[^"']+["'][^>]*>/gi, "")
    .replace(/\bsrc\s*=\s*(["'])cid:[^"']+\1/gi, "src=$1$1")
    .replace(/url\((["']?)cid:[^)"']+\1\)/gi, "none");
};
