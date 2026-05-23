export type BusinessHoursDay = {
  open?: string | null;
  close?: string | null;
  closed?: boolean;
};

export type BusinessHoursConfig = Record<string, BusinessHoursDay>;

const WEEKDAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const parseMinutes = (value?: string | null) => {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
};

export const isWithinBusinessHours = (
  businessHours: BusinessHoursConfig | null | undefined,
  at: Date = new Date(),
) => {
  if (!businessHours || Object.keys(businessHours).length === 0) return true;

  const dayKey = WEEKDAY_KEYS[at.getDay()];
  const day = businessHours[dayKey];
  if (!day || day.closed) return false;

  const openMinutes = parseMinutes(day.open);
  const closeMinutes = parseMinutes(day.close);
  if (openMinutes == null || closeMinutes == null) return true;

  const nowMinutes = at.getHours() * 60 + at.getMinutes();
  return nowMinutes >= openMinutes && nowMinutes <= closeMinutes;
};

export const expandAutoAckMessage = (
  template: string,
  variables: Record<string, string | null | undefined>,
) =>
  template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const value = variables[key];
    return value?.trim() ? value.trim() : "";
  });
