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

/** Shown on /leads — includes legacy buckets until data migration runs. */
export const LBS_LEAD_STATUSES = [
  "lead",
  "prospect",
  "warm",
  "cold",
  "new",
] as const;

/** Shown on /contacts — includes legacy `contact` until data migration runs. */
export const LBS_CONTACT_STATUSES = [
  "client",
  "contact_only",
  "inactive",
  "contact",
] as const;

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
