/** Shared sync range helpers for CRM Mail (client). */

export type MailSyncPreset =
  | "7d"
  | "30d"
  | "90d"
  | "365d"
  | "custom"
  | "all";

export type MailSyncRange = {
  /** ISO date (YYYY-MM-DD) or full ISO datetime; null = no lower bound (capped by max). */
  since: string | null;
  max_results: number;
  preset: MailSyncPreset;
};

const MAX_BY_PRESET: Record<MailSyncPreset, number> = {
  "7d": 200,
  "30d": 300,
  "90d": 400,
  "365d": 500,
  custom: 400,
  all: 500,
};

export function daysAgoIsoDate(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function resolveMailSyncRange(
  preset: MailSyncPreset,
  customDate?: string,
): MailSyncRange {
  const max_results = MAX_BY_PRESET[preset];
  if (preset === "all") {
    return { since: null, max_results, preset };
  }
  if (preset === "custom") {
    const since = (customDate || daysAgoIsoDate(30)).slice(0, 10);
    return { since, max_results, preset };
  }
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : preset === "90d" ? 90 : 365;
  return { since: daysAgoIsoDate(days), max_results, preset };
}

/** One-click Sync: recent mail only (no range dialog). */
export function incrementalMailSyncRange(
  lastSyncAt: string | null,
): MailSyncRange {
  if (lastSyncAt) {
    const overlapMs = 60 * 60 * 1000;
    const since = new Date(
      new Date(lastSyncAt).getTime() - overlapMs,
    ).toISOString();
    return { since, max_results: 50, preset: "custom" };
  }
  return { since: daysAgoIsoDate(2), max_results: 50, preset: "custom" };
}

export const MAIL_SYNC_PRESET_OPTIONS: Array<{
  value: MailSyncPreset;
  label: string;
  description: string;
}> = [
  {
    value: "7d",
    label: "Last 7 days",
    description: "Recent inbox only",
  },
  {
    value: "30d",
    label: "Last 30 days",
    description: "Recommended for first sync",
  },
  {
    value: "90d",
    label: "Last 90 days",
    description: "Larger mailbox history",
  },
  {
    value: "365d",
    label: "Last year",
    description: "May take longer",
  },
  {
    value: "custom",
    label: "Custom date…",
    description: "Pick a start date",
  },
  {
    value: "all",
    label: "As much as possible",
    description: "Capped for performance (newest first)",
  },
];
