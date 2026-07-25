/**
 * Infer US IANA timezone from state + ZIP.
 * Good enough for CRM defaults; El Paso (TX) and a few multi-zone states use ZIP hints.
 */

const STATE_TIMEZONE: Record<string, string> = {
  AL: "America/Chicago",
  AK: "America/Anchorage",
  AZ: "America/Phoenix",
  AR: "America/Chicago",
  CA: "America/Los_Angeles",
  CO: "America/Denver",
  CT: "America/New_York",
  DE: "America/New_York",
  DC: "America/New_York",
  FL: "America/New_York",
  GA: "America/New_York",
  HI: "Pacific/Honolulu",
  ID: "America/Boise",
  IL: "America/Chicago",
  IN: "America/Indiana/Indianapolis",
  IA: "America/Chicago",
  KS: "America/Chicago",
  KY: "America/New_York",
  LA: "America/Chicago",
  ME: "America/New_York",
  MD: "America/New_York",
  MA: "America/New_York",
  MI: "America/Detroit",
  MN: "America/Chicago",
  MS: "America/Chicago",
  MO: "America/Chicago",
  MT: "America/Denver",
  NE: "America/Chicago",
  NV: "America/Los_Angeles",
  NH: "America/New_York",
  NJ: "America/New_York",
  NM: "America/Denver",
  NY: "America/New_York",
  NC: "America/New_York",
  ND: "America/Chicago",
  OH: "America/New_York",
  OK: "America/Chicago",
  OR: "America/Los_Angeles",
  PA: "America/New_York",
  RI: "America/New_York",
  SC: "America/New_York",
  SD: "America/Chicago",
  TN: "America/Chicago",
  TX: "America/Chicago",
  UT: "America/Denver",
  VT: "America/New_York",
  VA: "America/New_York",
  WA: "America/Los_Angeles",
  WV: "America/New_York",
  WI: "America/Chicago",
  WY: "America/Denver",
};

/** ZIP prefixes that override the state default. */
const ZIP_PREFIX_OVERRIDES: Array<{ prefix: string; timezone: string }> = [
  // El Paso, TX — Mountain
  { prefix: "798", timezone: "America/Denver" },
  { prefix: "799", timezone: "America/Denver" },
  // Panhandle FL — Central
  { prefix: "324", timezone: "America/Chicago" },
  { prefix: "325", timezone: "America/Chicago" },
  // Northwest IN — Central
  { prefix: "463", timezone: "America/Chicago" },
  { prefix: "464", timezone: "America/Chicago" },
  // Eastern OR — Mountain-ish (use Boise)
  { prefix: "978", timezone: "America/Boise" },
  { prefix: "979", timezone: "America/Boise" },
];

const SHORT_LABEL: Record<string, string> = {
  "America/New_York": "ET",
  "America/Chicago": "CT",
  "America/Denver": "MT",
  "America/Phoenix": "MST",
  "America/Los_Angeles": "PT",
  "America/Anchorage": "AKT",
  "Pacific/Honolulu": "HT",
  "America/Detroit": "ET",
  "America/Indiana/Indianapolis": "ET",
  "America/Boise": "MT",
};

export const DEFAULT_ORG_TIMEZONE = "America/New_York";

/** Common US IANA zones for Settings selects. */
export const US_TIMEZONE_CHOICES: Array<{ id: string; name: string }> = [
  { id: "America/New_York", name: "Eastern (ET)" },
  { id: "America/Chicago", name: "Central (CT)" },
  { id: "America/Denver", name: "Mountain (MT)" },
  { id: "America/Phoenix", name: "Arizona (MST)" },
  { id: "America/Los_Angeles", name: "Pacific (PT)" },
  { id: "America/Anchorage", name: "Alaska (AKT)" },
  { id: "Pacific/Honolulu", name: "Hawaii (HT)" },
  { id: "America/Detroit", name: "Detroit (ET)" },
  { id: "America/Indiana/Indianapolis", name: "Indiana (ET)" },
  { id: "America/Boise", name: "Boise (MT)" },
];

export const timezoneShortLabel = (iana?: string | null) => {
  const key = iana?.trim() || "";
  if (!key) return "";
  return SHORT_LABEL[key] ?? (key.split("/").pop()?.replace(/_/g, " ") || key);
};

export const inferUsTimezoneFromAddress = (params: {
  stateAbbr?: string | null;
  zipcode?: string | null;
  country?: string | null;
}): string | null => {
  const country = (params.country ?? "US").trim().toUpperCase();
  if (country && country !== "US" && country !== "USA" && country !== "UNITED STATES") {
    return null;
  }

  const zipDigits = String(params.zipcode ?? "").replace(/\D/g, "");
  if (zipDigits.length >= 3) {
    const prefix = zipDigits.slice(0, 3);
    const override = ZIP_PREFIX_OVERRIDES.find((row) => row.prefix === prefix);
    if (override) return override.timezone;
  }

  const state = String(params.stateAbbr ?? "")
    .trim()
    .toUpperCase();
  if (!state) return null;
  return STATE_TIMEZONE[state] ?? null;
};

export const resolveOrgTimezoneFromAddress = (params: {
  timezone?: string | null;
  stateAbbr?: string | null;
  zipcode?: string | null;
  country?: string | null;
}): string => {
  const explicit = String(params.timezone ?? "").trim();
  if (explicit) return explicit;
  return (
    inferUsTimezoneFromAddress({
      stateAbbr: params.stateAbbr,
      zipcode: params.zipcode,
      country: params.country,
    }) ?? DEFAULT_ORG_TIMEZONE
  );
};

/**
 * Convert a wall-clock date+time in `timeZone` to UTC milliseconds.
 */
export const zonedWallTimeToUtcMs = (
  dateKey: string,
  timeKey: string,
  timeZone: string,
): number | null => {
  const date = String(dateKey).slice(0, 10);
  const time = String(timeKey).trim().slice(0, 5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return null;
  }
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const tz = timeZone.trim() || DEFAULT_ORG_TIMEZONE;

  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const readParts = (ms: number) => {
    const map: Record<string, string> = {};
    for (const part of dtf.formatToParts(new Date(ms))) {
      if (part.type !== "literal") map[part.type] = part.value;
    }
    const h = Number(map.hour);
    return {
      year: Number(map.year),
      month: Number(map.month),
      day: Number(map.day),
      hour: h === 24 ? 0 : h,
      minute: Number(map.minute),
      second: Number(map.second),
    };
  };

  // Initial guess: treat wall time as UTC, then correct using TZ offset.
  let utc = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 4; i += 1) {
    const parts = readParts(utc);
    const asIfUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const wanted = Date.UTC(year, month - 1, day, hour, minute, 0);
    const delta = wanted - asIfUtc;
    if (delta === 0) break;
    utc += delta;
  }

  const verify = readParts(utc);
  if (
    verify.year !== year ||
    verify.month !== month ||
    verify.day !== day ||
    verify.hour !== hour ||
    verify.minute !== minute
  ) {
    return utc; // best effort (DST edges)
  }
  return utc;
};

export const formatTimeInTimeZone = (
  utcMs: number,
  timeZone: string,
  options?: Intl.DateTimeFormatOptions,
) =>
  new Date(utcMs).toLocaleTimeString("en-US", {
    timeZone: timeZone.trim() || DEFAULT_ORG_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    ...options,
  });

export const formatDateInTimeZone = (
  utcMs: number,
  timeZone: string,
) =>
  new Date(utcMs).toLocaleDateString("en-US", {
    timeZone: timeZone.trim() || DEFAULT_ORG_TIMEZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
  });
