import {
  countCityOccurrences,
  firstAddressLine,
  stripEmbeddedLocationSuffix,
  type LocationSuffixParts,
} from "@/lbs/clients/addressSuffixStrip";

export type CompanyAddressRow = LocationSuffixParts & {
  id?: number;
  name?: string;
  address?: string | null;
  city?: string | null;
  state_abbr?: string | null;
  zipcode?: string | null;
  country?: string | null;
};

export type AddressNormalizeProposal = {
  method:
    | "restore-from-backup"
    | "multiline-parse"
    | "single-line-parse"
    | "strip-embedded-city-suffix";
  street: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
};

const hasStructuredColumns = (row: CompanyAddressRow) =>
  Boolean(
    row.city?.trim() ||
      row.state_abbr?.trim() ||
      row.zipcode?.trim() ||
      row.country?.trim(),
  );

/** Parse Zoho-style single-line US addresses: street, city, state, zip, country */
export const parseUSComposedAddress = (line: string | null | undefined) => {
  const trimmed = firstAddressLine(line);
  if (!trimmed) return null;

  const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 3) return null;

  let country: string | null = null;
  const last = parts[parts.length - 1];
  if (
    /^(U\.?S\.?A\.?|United States( of America)?)$/i.test(last) ||
    (parts.length >= 5 && !/^\d/.test(last))
  ) {
    country = last;
    parts.pop();
  }

  let zip: string | null = null;
  if (parts.length && /^\d{5}(-\d{4})?$/.test(parts[parts.length - 1])) {
    zip = parts.pop() ?? null;
  }

  let state: string | null = null;
  if (parts.length >= 2) {
    const maybeState = parts[parts.length - 1];
    if (/^[A-Z]{2}$/i.test(maybeState) || maybeState.length <= 15) {
      state = maybeState;
      parts.pop();
    }
  }

  let city: string | null = null;
  if (parts.length >= 2) {
    city = parts.pop() ?? null;
  }

  const street = parts.join(", ").trim();
  if (!street || !city) return null;

  return { street, city, state, zip, country };
};

export const columnsLostSinceBackup = (
  live: CompanyAddressRow,
  backup?: CompanyAddressRow | null,
) => {
  if (!backup) return false;
  return hasStructuredColumns(backup) && !hasStructuredColumns(live);
};

export const classifyAddressNormalizeBucket = (
  row: CompanyAddressRow,
  backup?: CompanyAddressRow | null,
): string | null => {
  if (columnsLostSinceBackup(row, backup)) return "backup-restore";
  if (row.address?.includes("\n")) return "multiline";
  if (!hasStructuredColumns(row) && parseUSComposedAddress(row.address)) {
    return "single-line-composed";
  }
  if (
    hasStructuredColumns(row) &&
    !row.address?.includes("\n") &&
    stripEmbeddedLocationSuffix(row.address, {
      city: row.city,
      stateAbbr: row.state_abbr,
      zipcode: row.zipcode,
      country: row.country,
    })
  ) {
    return "embedded-city";
  }
  return null;
};

export const normalizeCompanyAddressProposal = (
  live: CompanyAddressRow,
  backup?: CompanyAddressRow | null,
): AddressNormalizeProposal | null => {
  if (columnsLostSinceBackup(live, backup) && backup) {
    const parsedFromBackup = parseUSComposedAddress(backup.address);
    const parsedFromLive = parseUSComposedAddress(firstAddressLine(live.address));
    return {
      method: "restore-from-backup",
      street:
        parsedFromBackup?.street ??
        parsedFromLive?.street ??
        firstAddressLine(live.address),
      city: backup.city?.trim() || parsedFromLive?.city || null,
      state: backup.state_abbr?.trim() || parsedFromLive?.state || null,
      zip: backup.zipcode?.trim() || parsedFromLive?.zip || null,
      country: backup.country?.trim() || parsedFromLive?.country || null,
    };
  }

  const address = live.address?.trim() ?? "";
  if (!address) return null;

  if (address.includes("\n")) {
    const parsed = parseUSComposedAddress(firstAddressLine(address));
    return {
      method: "multiline-parse",
      street: parsed?.street ?? firstAddressLine(address),
      city: live.city?.trim() || parsed?.city || null,
      state: live.state_abbr?.trim() || parsed?.state || null,
      zip: live.zipcode?.trim() || parsed?.zip || null,
      country: live.country?.trim() || parsed?.country || null,
    };
  }

  if (!hasStructuredColumns(live)) {
    const parsed = parseUSComposedAddress(address);
    if (!parsed) return null;
    return {
      method: "single-line-parse",
      street: parsed.street,
      city: parsed.city,
      state: parsed.state,
      zip: parsed.zip,
      country: parsed.country,
    };
  }

  const street = stripEmbeddedLocationSuffix(address, {
    city: live.city,
    stateAbbr: live.state_abbr,
    zipcode: live.zipcode,
    country: live.country,
  });
  if (street) {
    return {
      method: "strip-embedded-city-suffix",
      street,
      city: live.city?.trim() || null,
      state: live.state_abbr?.trim() || null,
      zip: live.zipcode?.trim() || null,
      country: live.country?.trim() || null,
    };
  }

  return null;
};

export const applyAddressNormalizeProposal = (
  row: CompanyAddressRow,
  proposal: AddressNormalizeProposal,
): CompanyAddressRow => ({
  ...row,
  address: proposal.street,
  city: proposal.city,
  state_abbr: proposal.state,
  zipcode: proposal.zip,
  country: proposal.country,
});

/** Returns proposals for rows that still change after prior normalization. */
export const normalizeAddressPipeline = (
  rows: CompanyAddressRow[],
  backupById: Map<number, CompanyAddressRow>,
) => {
  const changed: Array<{
    row: CompanyAddressRow;
    proposal: AddressNormalizeProposal;
    bucket: string;
  }> = [];

  for (const row of rows) {
    const backup = row.id != null ? backupById.get(row.id) : undefined;
    const bucket = classifyAddressNormalizeBucket(row, backup);
    if (!bucket) continue;
    const proposal = normalizeCompanyAddressProposal(row, backup);
    if (!proposal) continue;
    changed.push({ row, proposal, bucket });
  }

  return changed;
};

export const verifyIdempotentSecondPass = (
  rows: CompanyAddressRow[],
  backupById: Map<number, CompanyAddressRow>,
) => {
  const firstPass = normalizeAddressPipeline(rows, backupById);
  const afterFirst = rows.map((row) => {
    const hit = firstPass.find((entry) => entry.row.id === row.id);
    return hit
      ? applyAddressNormalizeProposal(row, hit.proposal)
      : row;
  });
  const secondPass = normalizeAddressPipeline(afterFirst, backupById);
  return { firstPassCount: firstPass.length, secondPassCount: secondPass.length };
};

export { countCityOccurrences, stripEmbeddedLocationSuffix };
