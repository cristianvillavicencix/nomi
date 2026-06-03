#!/usr/bin/env node
/**
 * Bundle a Supabase edge function + transitive ../_shared imports for MCP deploy.
 * Usage: node scripts/bundle-edge-function.mjs get_public_proposal
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const functionsRoot = path.join(root, "supabase/functions");

const functionName = process.argv[2];
if (!functionName) {
  console.error("Usage: node scripts/bundle-edge-function.mjs <function_name>");
  process.exit(1);
}

const functionDir = path.join(functionsRoot, functionName);
const indexPath = path.join(functionDir, "index.ts");
if (!fs.existsSync(indexPath)) {
  console.error(`Missing ${indexPath}`);
  process.exit(1);
}

const collected = new Map();

const collectDeps = (filePath) => {
  const normalized = path.normalize(filePath);
  if (collected.has(normalized)) return;
  collected.set(normalized, null);

  const content = fs.readFileSync(normalized, "utf8");
  collected.set(normalized, content);

  const dir = path.dirname(normalized);
  const importRe = /from\s+["'](\.\.?\/[^"']+)["']/g;
  let match;
  while ((match = importRe.exec(content))) {
    let rel = match[1];
    if (!rel.endsWith(".ts") && !rel.endsWith(".tsx")) rel += ".ts";
    const resolved = path.normalize(path.join(dir, rel));
    if (fs.existsSync(resolved)) collectDeps(resolved);
  }
};

collectDeps(indexPath);

const files = [];
for (const [absPath, content] of collected) {
  const relToFunction = path
    .relative(functionDir, absPath)
    .replace(/\\/g, "/");
  files.push({
    name: relToFunction === "index.ts" ? "index.ts" : relToFunction,
    content,
  });
}

const denoJson = path.join(functionDir, "deno.json");
if (fs.existsSync(denoJson)) {
  files.push({
    name: "deno.json",
    content: fs.readFileSync(denoJson, "utf8"),
  });
}

console.log(JSON.stringify({ functionName, files }));
