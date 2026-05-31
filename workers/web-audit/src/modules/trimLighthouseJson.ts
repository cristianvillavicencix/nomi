const METRIC_AUDIT_IDS = [
  "first-contentful-paint",
  "largest-contentful-paint",
  "cumulative-layout-shift",
  "total-blocking-time",
  "speed-index",
  "interactive",
  "max-potential-fid",
];

const trimTableItems = (items: unknown[], max = 8) =>
  items.slice(0, max).map((row) => {
    if (!row || typeof row !== "object") return row;
    const record = row as Record<string, unknown>;
    const trimmed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      if (typeof value === "string" && value.length > 280) {
        trimmed[key] = `${value.slice(0, 280)}…`;
      } else {
        trimmed[key] = value;
      }
    }
    return trimmed;
  });

const trimDetails = (details: unknown): unknown => {
  if (!details || typeof details !== "object") return details;
  const d = details as Record<string, unknown>;
  const base: Record<string, unknown> = {
    type: d.type,
    overallSavingsMs: d.overallSavingsMs,
    overallSavings: d.overallSavings,
  };
  if (Array.isArray(d.items)) {
    base.items = trimTableItems(d.items);
  }
  if (Array.isArray(d.headings)) {
    base.headings = d.headings;
  }
  return base;
};

/** Store enough Lighthouse data for detailed UI without full LHR bloat. */
export const trimLighthouseJson = (
  lhr: Record<string, unknown>,
): Record<string, unknown> => {
  const categories = lhr.categories as Record<string, unknown> | undefined;
  const audits = (lhr.audits ?? {}) as Record<string, Record<string, unknown>>;
  const keepIds = new Set<string>(METRIC_AUDIT_IDS);

  for (const category of Object.values(categories ?? {})) {
    const rawRefs = (category as { auditRefs?: Array<{ id: string }> }).auditRefs;
    const refs = Array.isArray(rawRefs) ? rawRefs : [];
    for (const ref of refs) {
      if (ref?.id) keepIds.add(ref.id);
    }
  }

  const trimmedAudits: Record<string, unknown> = {};
  for (const id of keepIds) {
    const audit = audits[id];
    if (!audit) continue;
    trimmedAudits[id] = {
      id: audit.id,
      title: audit.title,
      description: audit.description,
      score: audit.score,
      scoreDisplayMode: audit.scoreDisplayMode,
      displayValue: audit.displayValue,
      numericValue: audit.numericValue,
      details: trimDetails(audit.details),
    };
  }

  return {
    categories,
    audits: trimmedAudits,
    finalDisplayedUrl: lhr.finalDisplayedUrl,
    requestedUrl: lhr.requestedUrl,
    fetchTime: lhr.fetchTime,
    lighthouseVersion: lhr.lighthouseVersion,
    categoryGroups: lhr.categoryGroups,
  };
};
