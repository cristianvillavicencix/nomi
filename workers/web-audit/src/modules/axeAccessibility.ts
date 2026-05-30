import puppeteer from "puppeteer-core";
import { AxePuppeteer } from "@axe-core/puppeteer";
import type { Result, AxeResults } from "axe-core";
import type { AuditChrome } from "./sharedChrome.js";
import type { AuditFindingInput } from "../types.js";

export type AxeAuditResult = {
  axeJson: Record<string, unknown>;
  findings: AuditFindingInput[];
  violationCount: number;
};

const IMPACT_ORDER: Record<string, number> = {
  critical: 0,
  serious: 1,
  moderate: 2,
  minor: 3,
};

const mapAxeImpactToSeverity = (
  impact: string | null | undefined,
): AuditFindingInput["severity"] => {
  switch (impact) {
    case "critical":
    case "serious":
      return "critico";
    case "moderate":
      return "importante";
    default:
      return "nice-to-have";
  }
};

const violationTitle = (violation: Result) =>
  violation.help?.trim() ||
  violation.description?.trim() ||
  violation.id ||
  "Accessibility issue";

const violationDescription = (violation: Result) => {
  const nodes = violation.nodes?.length ?? 0;
  const base = violation.description?.trim() ?? "";
  return nodes > 0 ? `${base} (${nodes} element${nodes === 1 ? "" : "s"} affected)`.trim() : base;
};

export const mapAxeViolationsToFindings = (
  violations: Result[],
  startOrder = 200,
): AuditFindingInput[] => {
  const sorted = [...violations].sort(
    (a, b) =>
      (IMPACT_ORDER[a.impact ?? "minor"] ?? 99) -
      (IMPACT_ORDER[b.impact ?? "minor"] ?? 99),
  );

  return sorted.slice(0, 20).map((violation, index) => ({
    category: "a11y",
    severity: mapAxeImpactToSeverity(violation.impact),
    source: "axe",
    source_id: violation.id,
    title: violationTitle(violation),
    description: violationDescription(violation) || null,
    recommendation: violation.helpUrl
      ? `Ver guía: ${violation.helpUrl}`
      : "Corrige esta regla de accesibilidad en el HTML/CSS del sitio.",
    metric_key: `axe:${violation.id}`,
    metric_value: violation.impact ?? null,
    display_order: startOrder + index,
  }));
};

const summarizeAxeJson = (results: AxeResults): Record<string, unknown> => ({
  url: results.url,
  timestamp: results.timestamp,
  testEngine: results.testEngine,
  testRunner: results.testRunner,
  violationCount: results.violations.length,
  incompleteCount: results.incomplete.length,
  passesCount: results.passes.length,
  violations: results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    description: v.description,
    helpUrl: v.helpUrl,
    nodes: v.nodes?.map((n) => ({
      html: n.html?.slice(0, 200),
      target: n.target,
      failureSummary: n.failureSummary,
    })),
  })),
});

/**
 * Runs axe-core on the page via puppeteer-core connected to the same Chromium
 * instance Lighthouse used (CDP). Does NOT launch a second browser.
 */
export const runAxeAccessibility = async (
  url: string,
  chrome: AuditChrome,
  signal: AbortSignal,
): Promise<AxeAuditResult> => {
  if (signal.aborted) {
    throw new Error("Axe audit aborted");
  }

  const browser = await puppeteer.connect({
    browserURL: `http://127.0.0.1:${chrome.port}`,
    defaultViewport: null,
  });

  try {
    const pages = await browser.pages();
    const page = pages[0] ?? (await browser.newPage());

    if (!pages.length) {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
    }

    // @axe-core/puppeteer bundles a nested puppeteer-core; types differ from our direct import.
    const results = await new AxePuppeteer(page as never).analyze();
    const findings = mapAxeViolationsToFindings(results.violations);

    return {
      axeJson: summarizeAxeJson(results),
      findings,
      violationCount: results.violations.length,
    };
  } finally {
    browser.disconnect();
  }
};
