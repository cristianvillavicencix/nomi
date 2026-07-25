#!/usr/bin/env node
/**
 * Guard against entry chunk regressions. Sync limits with docs/performance/BUNDLE-BASELINE.md.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const BASELINE = {
  /** Post round-2 entry parsed size (KiB). Sync with BUNDLE-BASELINE.md. */
  entryParsedKb: 3202,
  /** Post round-2 entry gzip size (KiB). Sync with BUNDLE-BASELINE.md. */
  entryGzipKb: 956,
  thresholdPercent: 10,
};

const distAssets = path.join(process.cwd(), "dist", "assets");

if (!fs.existsSync(distAssets)) {
  console.error(
    "check-bundle-size: dist/assets not found. Run `npm run build` first.",
  );
  process.exit(1);
}

const indexFiles = fs
  .readdirSync(distAssets)
  .filter((file) => /^index-[^/]+\.js$/.test(file));

if (indexFiles.length === 0) {
  console.error("check-bundle-size: no index-*.js entry chunk in dist/assets.");
  process.exit(1);
}

const entryPath = indexFiles
  .map((file) => path.join(distAssets, file))
  .sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0];

const content = fs.readFileSync(entryPath);
const parsedKb = Math.round(content.length / 1024);
const gzipKb = Math.round(zlib.gzipSync(content).length / 1024);
const maxParsedKb = Math.round(
  BASELINE.entryParsedKb * (1 + BASELINE.thresholdPercent / 100),
);
const maxGzipKb = Math.round(
  BASELINE.entryGzipKb * (1 + BASELINE.thresholdPercent / 100),
);

const parsedOk = parsedKb <= maxParsedKb;
const gzipOk = gzipKb <= maxGzipKb;

console.log(`Entry chunk: ${path.basename(entryPath)}`);
console.log(`  Parsed: ${parsedKb} KiB (limit ${maxParsedKb} KiB)`);
console.log(`  Gzip:   ${gzipKb} KiB (limit ${maxGzipKb} KiB)`);

if (!parsedOk || !gzipOk) {
  console.error(
    "\ncheck-bundle-size: entry chunk exceeds baseline + threshold.",
  );
  console.error(
    "Update docs/performance/BUNDLE-BASELINE.md only after intentional changes.",
  );
  process.exit(1);
}

console.log("check-bundle-size: OK");
