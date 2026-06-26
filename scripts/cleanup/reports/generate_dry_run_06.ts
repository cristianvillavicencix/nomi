#!/usr/bin/env npx tsx
/**
 * Dry-run + embedded-city review for script 06.
 * Usage: npx tsx scripts/cleanup/reports/generate_dry_run_06.ts
 */
import fs from "node:fs";
import { execSync } from "node:child_process";
import {
  applyAddressNormalizeProposal,
  classifyAddressNormalizeBucket,
  countCityOccurrences,
  normalizeAddressPipeline,
  normalizeCompanyAddressProposal,
  verifyIdempotentSecondPass,
  type CompanyAddressRow,
} from "../../../src/lbs/clients/addressNormalize.ts";

function loadBackupCompanies(): CompanyAddressRow[] {
  const raw = fs.readFileSync(
    "scripts/cleanup/backups/companies_pre_cleanup.json",
    "utf8",
  );
  return JSON.parse(raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1));
}

function query(sql: string): CompanyAddressRow[] {
  const out = execSync(
    `supabase db query --linked ${JSON.stringify(sql)} -o json`,
    {
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    },
  );
  return JSON.parse(out).rows ?? [];
}

const backupById = new Map(
  loadBackupCompanies().map((company) => [company.id!, company]),
);
const allCompanies = query(
  "SELECT id, name, address, city, state_abbr, zipcode, country FROM companies ORDER BY id",
);

const pipeline = normalizeAddressPipeline(allCompanies, backupById);
const buckets = {
  multiline: pipeline.filter((e) => e.bucket === "multiline"),
  singleLineComposed: pipeline.filter(
    (e) => e.bucket === "single-line-composed",
  ),
  embeddedCity: pipeline.filter((e) => e.bucket === "embedded-city"),
  backupRestore: pipeline.filter((e) => e.bucket === "backup-restore"),
};

const idempotency = verifyIdempotentSecondPass(allCompanies, backupById);

const embeddedFlagged = buckets.embeddedCity.map((entry) => {
  const street = entry.proposal.street;
  const cityCount = countCityOccurrences(entry.row.address, entry.row.city);
  const shortStreet = street.length < 8;
  const duplicateCity = cityCount > 1;
  return {
    ...entry,
    cityCount,
    shortStreet,
    duplicateCity,
    flagged: shortStreet || duplicateCity,
  };
});

const flaggedFirst = embeddedFlagged.filter((e) => e.flagged);
const rest = embeddedFlagged.filter((e) => !e.flagged);
const review15 = [...flaggedFirst, ...rest].slice(0, 15);

const fmt = (value: unknown) =>
  value == null || value === "" ? "null" : String(value);

const reviewSection = review15
  .map((entry) => {
    const flags = [
      entry.shortStreet
        ? `short street (${entry.proposal.street.length} chars)`
        : null,
      entry.duplicateCity ? `city×${entry.cityCount} in address` : null,
    ]
      .filter(Boolean)
      .join("; ");

    return `### ${entry.row.id} — ${entry.row.name}${flags ? ` ⚠️ ${flags}` : ""}

**Before**
- address: \`${String(entry.row.address ?? "").replace(/\n/g, "\\n")}\`
- city: ${fmt(entry.row.city)} | state: ${fmt(entry.row.state_abbr)} | zip: ${fmt(entry.row.zipcode)}

**After (suffix-anchored strip)**
- address: \`${entry.proposal.street}\`
`;
  })
  .join("\n");

const approvedBucketsCount =
  buckets.multiline.length +
  buckets.singleLineComposed.length +
  buckets.backupRestore.length;

const report = `# Script 06 — dry-run (suffix-anchored embedded-city review)

**Database:** \`qjglkywmqwqdoaboakao\`  
**Generated:** ${new Date().toISOString().slice(0, 10)}

## Approved buckets (apply now: ${approvedBucketsCount} rows)

| Bucket | Count |
|--------|------:|
| Multiline | ${buckets.multiline.length} |
| Single-line parse | ${buckets.singleLineComposed.length} |
| Backup restore | ${buckets.backupRestore.length} |

## Pending review: embedded-city (suffix-anchored)

| Metric | Value |
|--------|------:|
| Total embedded-city candidates | ${buckets.embeddedCity.length} |
| Flagged (short street or city×2+) | ${flaggedFirst.length} |
| Idempotency: pass-1 changes | ${idempotency.firstPassCount} |
| Idempotency: pass-2 changes | ${idempotency.secondPassCount} |

### Mechanism

Removes **only** a trailing suffix matching \`, {city}, {state} {zip}...\` anchored at end.
Does **not** use substring search — e.g. \`123 Danbury Rd, Danbury, CT 06811\` → \`123 Danbury Rd\`.

### 15 review examples (flagged first)

${reviewSection}

## Embedded-city flags summary

| ID | Name | Street len | City occurrences | Flag |
|----|------|----------:|-----------------:|------|
${
  embeddedFlagged
    .filter((e) => e.flagged)
    .map(
      (e) =>
        `| ${e.row.id} | ${e.row.name} | ${e.proposal.street.length} | ${e.cityCount} | ${e.shortStreet ? "short" : ""}${e.shortStreet && e.duplicateCity ? "+" : ""}${e.duplicateCity ? "dup-city" : ""} |`,
    )
    .join("\n") || "| — | — | — | — | none |"
}

**Do not apply embedded-city bucket until approved.**
`;

fs.writeFileSync("scripts/cleanup/reports/DRY_RUN_06_2026-06-02.md", report);
fs.writeFileSync("scripts/cleanup/reports/EMBEDDED_CITY_REVIEW_06.md", report);

console.log(
  JSON.stringify(
    {
      approvedRows: approvedBucketsCount,
      embeddedCity: buckets.embeddedCity.length,
      embeddedFlagged: flaggedFirst.length,
      idempotency,
      reviewExamples: review15.length,
    },
    null,
    2,
  ),
);
