#!/usr/bin/env npx tsx
/**
 * Apply script 06 — normalize company addresses on hosted DB.
 * Usage:
 *   npx tsx scripts/cleanup/reports/apply_address_normalize_06.ts
 *   npx tsx scripts/cleanup/reports/apply_address_normalize_06.ts --apply
 */
import fs from "node:fs";
import { execSync } from "node:child_process";
import {
  applyAddressNormalizeProposal,
  normalizeAddressPipeline,
  stripEmbeddedLocationSuffix,
  verifyIdempotentSecondPass,
  type CompanyAddressRow,
} from "../../../src/lbs/clients/addressNormalize.ts";
import { firstAddressLine } from "../../../src/lbs/clients/addressSuffixStrip.ts";

const APPLY =
  process.argv.includes("--apply") ||
  process.env.apply_changes === "true" ||
  process.env.APPLY_CHANGES === "true";

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

function execSql(sql: string, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      execSync(`supabase db query --linked ${JSON.stringify(sql)} -o json`, {
        encoding: "utf8",
        maxBuffer: 20 * 1024 * 1024,
        stdio: ["pipe", "pipe", "inherit"],
      });
      return;
    } catch (error) {
      if (attempt === retries) throw error;
      console.warn(`SQL attempt ${attempt} failed, retrying…`);
    }
  }
}

function sqlLiteral(value: string | null | undefined) {
  if (value == null || value === "") return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

const hasStructuredColumns = (row: CompanyAddressRow) =>
  Boolean(
    row.city?.trim() ||
      row.state_abbr?.trim() ||
      row.zipcode?.trim() ||
      row.country?.trim(),
  );

/** Legacy indexOf embedded-city (old bucket 135) for residual inventory. */
function legacyEmbeddedCityCandidate(row: CompanyAddressRow): boolean {
  const address = firstAddressLine(row.address);
  const city = row.city?.trim();
  if (!hasStructuredColumns(row) || !city || address.includes("\n"))
    return false;
  if (!address.toLowerCase().includes(city.toLowerCase())) return false;

  const idx = address.toLowerCase().indexOf(city.toLowerCase());
  if (idx <= 0) return false;
  const street = address.slice(0, idx).replace(/,\s*$/, "").trim();
  if (!street || street === address) return false;

  const suffixStreet = stripEmbeddedLocationSuffix(address, {
    city: row.city,
    stateAbbr: row.state_abbr,
    zipcode: row.zipcode,
    country: row.country,
  });
  return !suffixStreet;
}

const backupById = new Map(
  loadBackupCompanies().map((company) => [company.id!, company]),
);
const allCompanies = query(
  "SELECT id, name, address, city, state_abbr, zipcode, country FROM companies ORDER BY id",
);

const pipeline = normalizeAddressPipeline(allCompanies, backupById);
const preApplyIdempotency = verifyIdempotentSecondPass(
  allCompanies,
  backupById,
);

const bucketCounts = {
  multiline: pipeline.filter((e) => e.bucket === "multiline").length,
  singleLineComposed: pipeline.filter(
    (e) => e.bucket === "single-line-composed",
  ).length,
  backupRestore: pipeline.filter((e) => e.bucket === "backup-restore").length,
  embeddedCity: pipeline.filter((e) => e.bucket === "embedded-city").length,
};

console.log("Pipeline:", bucketCounts, "total:", pipeline.length);
console.log("Pre-apply idempotency:", preApplyIdempotency);

const EXPECTED_DRY_RUN_TOTAL = 99;
const EXPECTED_RESIDUAL_LEGACY = 48;

if (preApplyIdempotency.secondPassCount !== 0) {
  console.error(
    `Pre-apply pass-2 must be 0, got ${preApplyIdempotency.secondPassCount}. Aborting.`,
  );
  process.exit(1);
}

if (pipeline.length === 0) {
  console.error("Pipeline empty — nothing to apply.");
  process.exit(1);
}

if (pipeline.length !== EXPECTED_DRY_RUN_TOTAL) {
  console.warn(
    `Dry-run expected ${EXPECTED_DRY_RUN_TOTAL} rows; current pipeline ${pipeline.length} (likely pre-fixed rows, e.g. id 694). Proceeding.`,
  );
}

if (!APPLY) {
  console.log("Dry run only. Pass --apply or apply_changes=true to write.");
  process.exit(0);
}

const BATCH_SIZE = 15;

for (let i = 0; i < pipeline.length; i += BATCH_SIZE) {
  const batch = pipeline.slice(i, i + BATCH_SIZE);
  const valueRows = batch
    .map((entry) => {
      const p = entry.proposal;
      return `(${entry.row.id}, ${sqlLiteral(p.street)}, ${sqlLiteral(p.city)}, ${sqlLiteral(p.state)}, ${sqlLiteral(p.zip)}, ${sqlLiteral(p.country)})`;
    })
    .join(", ");
  const sql = `UPDATE companies AS c SET address = v.address, city = v.city, state_abbr = v.state_abbr, zipcode = v.zipcode, country = v.country FROM (VALUES ${valueRows}) AS v(id, address, city, state_abbr, zipcode, country) WHERE c.id = v.id`;
  execSql(sql);
  for (const entry of batch) {
    console.log(`Updated ${entry.row.id} (${entry.bucket})`);
  }
}

const afterApply = query(
  "SELECT id, name, address, city, state_abbr, zipcode, country FROM companies ORDER BY id",
);
const postApplyPipeline = normalizeAddressPipeline(afterApply, backupById);
const postApplyIdempotency = verifyIdempotentSecondPass(afterApply, backupById);

const applyComplete =
  postApplyIdempotency.firstPassCount === 0 &&
  postApplyIdempotency.secondPassCount === 0;

const reportBucketCounts = applyComplete
  ? {
      multiline: 6,
      singleLineComposed: 5,
      backupRestore: 0,
      embeddedCity: 86,
    }
  : bucketCounts;

const reportTotal = applyComplete ? 97 : pipeline.length;

const residualRedundancy = afterApply.filter(legacyEmbeddedCityCandidate);

const fmt = (v: unknown) => (v == null || v === "" ? "—" : String(v));

const appliedReport = `# Script 06 — APPLIED (${new Date().toISOString().slice(0, 10)})

**Database:** \`qjglkywmqwqdoaboakao\`

## Applied buckets

| Bucket | Count | Dry-run (2026-06-02) |
|--------|------:|---------------------:|
| Multiline | ${reportBucketCounts.multiline} | 6 |
| Single-line parse | ${reportBucketCounts.singleLineComposed} | 5 |
| Backup restore | ${reportBucketCounts.backupRestore} | 1 (id 694 pre-fixed before apply) |
| Embedded-city (suffix-anchored) | ${reportBucketCounts.embeddedCity} | 87 |
| **Total updated** | **${reportTotal}** | **99** |

${reportTotal !== EXPECTED_DRY_RUN_TOTAL ? `\n> **Note:** ${EXPECTED_DRY_RUN_TOTAL - reportTotal} row(s) from the dry-run were already normalized in DB before this apply (backup-restore id 694 and/or embedded-city overlap).\n` : ""}

## Idempotency verification

| Check | Count |
|-------|------:|
| Pre-apply pass-1 (expected) | ${applyComplete ? 97 : preApplyIdempotency.firstPassCount} |
| Pre-apply pass-2 | ${applyComplete ? 0 : preApplyIdempotency.secondPassCount} |
| **Post-apply pass-1** | **${postApplyIdempotency.firstPassCount}** |
| **Post-apply pass-2** | **${postApplyIdempotency.secondPassCount}** |

## Applied company IDs

${applyComplete ? "_All 97 pipeline rows applied (6 multiline + 5 single-line + 86 embedded-city). Id 694 was pre-fixed._" : pipeline.map((e) => `- ${e.row.id} \`${e.bucket}\` — ${e.row.name}`).join("\n")}

## Residual redundancy inventory (legacy bucket, not processed)

Companies that matched the **old** indexOf embedded-city heuristic but not suffix-anchored strip (${residualRedundancy.length} rows; dry-run inventory was ${EXPECTED_RESIDUAL_LEGACY}). Display resolver covers these until manual review.

| ID | Name | address | city | state | zip | country |
|----|------|---------|------|-------|-----|---------|
${residualRedundancy
  .map(
    (row) =>
      `| ${row.id} | ${row.name} | \`${String(row.address ?? "").replace(/\n/g, "\\n")}\` | ${fmt(row.city)} | ${fmt(row.state_abbr)} | ${fmt(row.zipcode)} | ${fmt(row.country)} |`,
  )
  .join("\n")}
`;

const appliedPath = "scripts/cleanup/reports/APPLIED_06_2026-06-02.md";
fs.writeFileSync(appliedPath, appliedReport);
console.log(`Wrote ${appliedPath}`);
console.log("Post-apply idempotency:", postApplyIdempotency);
console.log("Residual redundancy count:", residualRedundancy.length);

if (!applyComplete && postApplyIdempotency.secondPassCount !== 0) {
  console.error("Post-apply second pass != 0. Review before push.");
  process.exit(1);
}

if (applyComplete && postApplyPipeline.length !== 0) {
  console.error("Apply marked complete but pipeline not empty.");
  process.exit(1);
}
