#!/usr/bin/env node
/**
 * Dry-run report for script 06 — company address normalization.
 * Usage: node scripts/cleanup/reports/generate_dry_run_06.mjs
 */
import fs from "node:fs";
import { execSync } from "node:child_process";

function loadBackupCompanies() {
  const raw = fs.readFileSync(
    "scripts/cleanup/backups/companies_pre_cleanup.json",
    "utf8",
  );
  return JSON.parse(raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1));
}

function query(sql) {
  const out = execSync(`supabase db query --linked ${JSON.stringify(sql)} -o json`, {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  return JSON.parse(out).rows ?? [];
}

const firstLine = (address) =>
  String(address ?? "")
    .trim()
    .split("\n")[0]
    ?.trim() ?? "";

const hasStructuredColumns = (row) =>
  Boolean(
    row.city?.trim() ||
      row.state_abbr?.trim() ||
      row.zipcode?.trim() ||
      row.country?.trim(),
  );

/** Parse Zoho-style single-line US addresses: street, city, state, zip, country */
export function parseUSComposedAddress(line) {
  const trimmed = firstLine(line);
  if (!trimmed) return null;

  const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 3) return null;

  let country = null;
  const last = parts[parts.length - 1];
  if (
    /^(U\.?S\.?A\.?|United States( of America)?)$/i.test(last) ||
    (parts.length >= 5 && !/^\d/.test(last))
  ) {
    country = last;
    parts.pop();
  }

  let zip = null;
  if (parts.length && /^\d{5}(-\d{4})?$/.test(parts[parts.length - 1])) {
    zip = parts.pop();
  }

  let state = null;
  if (parts.length >= 2) {
    const maybeState = parts[parts.length - 1];
    if (/^[A-Z]{2}$/i.test(maybeState) || maybeState.length <= 15) {
      state = maybeState;
      parts.pop();
    }
  }

  let city = null;
  if (parts.length >= 2) {
    city = parts.pop();
  }

  const street = parts.join(", ").trim();
  if (!street || !city) return null;

  return { street, city, state, zip, country };
}

export function columnsLostSinceBackup(live, backup) {
  if (!backup) return false;
  const backupHad = hasStructuredColumns(backup);
  const liveHas = hasStructuredColumns(live);
  return backupHad && !liveHas;
}

export function normalizeCompanyAddressProposal(live, backup) {
  if (columnsLostSinceBackup(live, backup)) {
    const parsedFromBackup = parseUSComposedAddress(backup.address);
    const parsedFromLive = parseUSComposedAddress(firstLine(live.address));
    return {
      method: "restore-from-backup",
      street:
        parsedFromBackup?.street ??
        parsedFromLive?.street ??
        firstLine(live.address),
      city: backup.city?.trim() || parsedFromLive?.city || null,
      state: backup.state_abbr?.trim() || parsedFromLive?.state || null,
      zip: backup.zipcode?.trim() || parsedFromLive?.zip || null,
      country: backup.country?.trim() || parsedFromLive?.country || null,
    };
  }

  const address = live.address?.trim() ?? "";
  if (!address) return null;

  if (address.includes("\n")) {
    const parsed = parseUSComposedAddress(firstLine(address));
    return {
      method: "multiline-parse",
      street: parsed?.street ?? firstLine(address),
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

  const city = live.city?.trim();
  if (city && address.toLowerCase().includes(city.toLowerCase())) {
    const idx = address.toLowerCase().indexOf(city.toLowerCase());
    const street = address.slice(0, idx).replace(/,\s*$/, "").trim();
    if (street && street !== address) {
      return {
        method: "strip-embedded-city",
        street,
        city: live.city,
        state: live.state_abbr,
        zip: live.zipcode,
        country: live.country,
      };
    }
  }

  return null;
}

function classifyRow(row, backup) {
  if (columnsLostSinceBackup(row, backup)) return "backup-restore";
  if (row.address?.includes("\n")) return "multiline";
  if (!hasStructuredColumns(row) && parseUSComposedAddress(row.address)) {
    return "single-line-composed";
  }
  const city = row.city?.trim();
  if (city && row.address?.includes(city)) return "embedded-city";
  return null;
}

const backupById = new Map(loadBackupCompanies().map((c) => [c.id, c]));
const allCompanies = query(
  "SELECT id, name, address, city, state_abbr, zipcode, country FROM companies ORDER BY id",
);

const proposals = [];
const buckets = {
  multiline: [],
  singleLineComposed: [],
  embeddedCity: [],
  backupRestore: [],
};

for (const row of allCompanies) {
  const backup = backupById.get(row.id);
  const bucket = classifyRow(row, backup);
  if (!bucket) continue;

  const proposal = normalizeCompanyAddressProposal(row, backup);
  if (!proposal) continue;

  const entry = { row, backup, proposal, bucket };
  proposals.push(entry);

  if (bucket === "multiline") buckets.multiline.push(entry);
  if (bucket === "single-line-composed") buckets.singleLineComposed.push(entry);
  if (bucket === "embedded-city") buckets.embeddedCity.push(entry);
  if (bucket === "backup-restore") buckets.backupRestore.push(entry);
}

const sampleIds = [694, 588, 587, 596, 612];
const samples = sampleIds.map((id) => {
  const row = allCompanies.find((c) => c.id === id);
  const backup = backupById.get(id);
  return {
    row,
    backup,
    bucket: row ? classifyRow(row, backup) : null,
    proposal: row ? normalizeCompanyAddressProposal(row, backup) : null,
  };
});

const examples = [
  ...buckets.backupRestore,
  ...buckets.multiline,
  ...buckets.singleLineComposed,
  ...buckets.embeddedCity,
]
  .filter(
    (entry, index, arr) =>
      arr.findIndex((candidate) => candidate.row.id === entry.row.id) === index,
  )
  .slice(0, 10);

const fmt = (value) => (value == null || value === "" ? "null" : value);

const report = `# Script 06 — address normalization dry-run (regenerated)

**Database:** \`qjglkywmqwqdoaboakao\`  
**Generated:** ${new Date().toISOString().slice(0, 10)}

## Counts (companies that would change)

| Bucket | Count | Action |
|--------|------:|--------|
| Multiline \`address\` blob | ${buckets.multiline.length} | Parse first line + populate columns |
| Single-line composed, empty columns | ${buckets.singleLineComposed.length} | Parse comma-separated US address |
| Embedded city + populated columns | ${buckets.embeddedCity.length} | Trim \`address\` to street only |
| **Backup restore** (live lost columns) | ${buckets.backupRestore.length} | Restore city/state/zip/country from backup JSON |
| **Total unique companies** | **${proposals.length}** | |

## Sample diagnosis (587, 588, 596, 612, 694)

| ID | Name | Bucket | Backup identical? |
|----|------|--------|-------------------|
${samples
  .filter((s) => s.row)
  .map(({ row, backup, bucket }) => {
    const identical =
      JSON.stringify({
        address: row.address,
        city: row.city,
        state_abbr: row.state_abbr,
        zipcode: row.zipcode,
        country: row.country,
      }) ===
      JSON.stringify({
        address: backup?.address ?? null,
        city: backup?.city ?? null,
        state_abbr: backup?.state_abbr ?? null,
        zipcode: backup?.zipcode ?? null,
        country: backup?.country ?? null,
      });
    return `| ${row.id} | ${row.name} | ${bucket ?? "—"} | ${identical ? "yes" : "no"} |`;
  })
  .join("\n")}

## Before / after (10 examples)

${examples
  .map(({ row, proposal }) => {
    return `### ${row.id} — ${row.name} (\`${proposal.method}\`)

**Before**
- address: \`${String(row.address ?? "").replace(/\n/g, "\\n")}\`
- city: ${fmt(row.city)} | state: ${fmt(row.state_abbr)} | zip: ${fmt(row.zipcode)} | country: ${fmt(row.country)}

**After (proposed)**
- address: \`${proposal.street}\`
- city: ${fmt(proposal.city)} | state: ${fmt(proposal.state)} | zip: ${fmt(proposal.zip)} | country: ${fmt(proposal.country)}
`;
  })
  .join("\n")}

## Policy notes

- **694 Able Roofing:** \`backup-restore\` — live nulled city/state/zip via edit; backup JSON is source of truth for structured columns.
- **596 VALMON:** \`single-line-composed\` — full Zoho string in \`address\`; parse into columns, street = \`123 Heminway Avenue\`.
- **587 Megaforce:** \`embedded-city\` — columns populated but \`address\` still contains full composed string; trim to street line.
- Frontend \`resolveCompanyAddressForDisplay()\` shows raw \`address\` when columns empty until this script runs.

**Do not apply** UPDATE until explicitly approved.
`;

const outPath = "scripts/cleanup/reports/DRY_RUN_06_2026-06-02.md";
fs.writeFileSync(outPath, report);
console.log(`Wrote ${outPath}`);
console.log(
  JSON.stringify(
    {
      total: proposals.length,
      multiline: buckets.multiline.length,
      singleLineComposed: buckets.singleLineComposed.length,
      embeddedCity: buckets.embeddedCity.length,
      backupRestore: buckets.backupRestore.length,
    },
    null,
    2,
  ),
);
