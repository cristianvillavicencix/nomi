import { deterministicPeepUrl } from "./openPeeps";

export type AvatarType = "peep" | "upload" | "default";

/**
 * Minimal shape any user-bearing record we care about will satisfy. Both
 * `people` and `organization_members` have these fields (legacy `avatar`
 * jsonb is honored when the new explicit columns are null).
 */
export type AvatarBearingRecord = {
  id?: string | number | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  user_id?: string | null;
  avatar_type?: AvatarType | string | null;
  avatar_url?: string | null;
  avatar?: { src?: string | null } | null;
};

/**
 * Picks the right avatar URL to render in the UI. Priority:
 *   1. Explicit new columns (avatar_type + avatar_url) when type !== "default"
 *   2. Legacy jsonb `avatar.src` (preserves existing uploads pre-migration)
 *   3. Deterministic peep based on a stable identifier so the user still
 *      sees a face even if they never chose one.
 */
export const resolveAvatarUrl = (
  record: AvatarBearingRecord | null | undefined,
  size = 96,
): string => {
  if (!record) {
    return deterministicPeepUrl("nomi-default", size);
  }
  if (
    record.avatar_url &&
    record.avatar_type &&
    record.avatar_type !== "default"
  ) {
    return record.avatar_url;
  }
  const legacy = record.avatar?.src;
  if (legacy) {
    return legacy;
  }
  const seedSource =
    record.user_id ||
    record.email ||
    `${record.first_name ?? ""}-${record.last_name ?? ""}` ||
    String(record.id ?? "nomi-default");
  return deterministicPeepUrl(seedSource, size);
};

/** Initials fallback used when an <img> 404s or while it loads. */
export const initialsOf = (record: AvatarBearingRecord | null | undefined) => {
  const first = (record?.first_name ?? "").trim().charAt(0);
  const last = (record?.last_name ?? "").trim().charAt(0);
  return `${first}${last}`.toUpperCase() || "?";
};
