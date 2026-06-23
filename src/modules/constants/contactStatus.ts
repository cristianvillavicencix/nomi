/**
 * Canonical contact status vocabulary (clients + leads module).
 * Legacy values remain in LBS_*_STATUSES filter arrays until script
 * `scripts/cleanup/04_normalize_contact_status.sql` is applied.
 */

export const CONTACT_STATUS_CHOICES = [
  { value: "lead", label: "Lead" },
  { value: "prospect", label: "Prospect" },
  { value: "client", label: "Client" },
  { value: "contact_only", label: "Contact only" },
  { value: "inactive", label: "Inactive" },
] as const;

export type ContactStatusValue =
  (typeof CONTACT_STATUS_CHOICES)[number]["value"];

/** Shown on /leads */
export const LBS_LEAD_STATUSES = ["lead", "prospect"] as const;

/** Legacy lead buckets still present in DB until cleanup script 04 runs. */
export const LBS_LEAD_STATUSES_LEGACY = ["new", "warm", "cold"] as const;

/** List/search filters — canonical + legacy lead statuses. */
export const LBS_LEAD_STATUSES_FOR_FILTER = [
  ...LBS_LEAD_STATUSES,
  ...LBS_LEAD_STATUSES_LEGACY,
] as const;

/** Shown on /contacts */
export const LBS_CONTACT_STATUSES = [
  "client",
  "contact_only",
  "inactive",
] as const;

/** Legacy contact bucket (`contact` → `contact_only` in cleanup script 04). */
export const LBS_CONTACT_STATUSES_LEGACY = ["contact"] as const;

/** List/search filters — canonical + legacy contact statuses. */
export const LBS_CONTACT_STATUSES_FOR_FILTER = [
  ...LBS_CONTACT_STATUSES,
  ...LBS_CONTACT_STATUSES_LEGACY,
] as const;

export const isLeadLifecycleStatus = (status?: string | null) =>
  !!status &&
  (LBS_LEAD_STATUSES_FOR_FILTER as readonly string[]).includes(status);

export const isContactDirectoryStatus = (status?: string | null) =>
  !!status &&
  (LBS_CONTACT_STATUSES_FOR_FILTER as readonly string[]).includes(status);

export const LBS_CLIENT_STATUS: ContactStatusValue = "client";

/** Proposed mapping for cleanup script 04 (dry-run report). */
export const CONTACT_STATUS_LEGACY_MAP: Record<string, ContactStatusValue> = {
  contact: "contact_only",
  warm: "prospect",
  cold: "prospect",
  new: "lead",
  lead: "lead",
  prospect: "prospect",
  client: "client",
  inactive: "inactive",
  contact_only: "contact_only",
};
