import { runLighthouseAudit } from "./lighthouseAudit.js";
import { runAxeAccessibility } from "./axeAccessibility.js";
import {
  killAuditChrome,
  launchAuditChrome,
  type AuditChrome,
} from "./sharedChrome.js";
import type {
  AuditFindingInput,
  AuditStrategySnapshot,
  WebsiteAuditStrategy,
} from "../types.js";
import type { LighthouseScores } from "../types.js";

export type StrategyPassResult = {
  scores: LighthouseScores;
  axeJson: Record<string, unknown> | null;
  axeFindings: AuditFindingInput[];
  snapshot: AuditStrategySnapshot;
};

const toSnapshot = (
  scores: LighthouseScores,
  axeJson: Record<string, unknown> | null,
): AuditStrategySnapshot => ({
  overall_score: scores.overall,
  score_performance: scores.performance,
  score_seo: scores.seo,
  score_best_practices: scores.bestPractices,
  score_accessibility: scores.accessibility,
  lab_lcp_ms: scores.labLcpMs,
  lab_cls: scores.labCls,
  lab_tbt_ms: scores.labTbtMs,
  lighthouse_json: scores.lighthouseJson,
  axe_json: axeJson,
});

/** One Lighthouse + axe pass for a form factor (own Chromium instance). */
export const runStrategyPass = async (
  auditUrl: string,
  strategy: WebsiteAuditStrategy,
  signal: AbortSignal,
): Promise<StrategyPassResult> => {
  if (strategy === "unified") {
    throw new Error("runStrategyPass requires mobile or desktop");
  }

  let chrome: AuditChrome | null = await launchAuditChrome();

  try {
    const { scores, chrome: connected } = await runLighthouseAudit(
      auditUrl,
      strategy,
      signal,
      chrome,
    );
    chrome = connected;

    let axeJson: Record<string, unknown> | null = null;
    let axeFindings: AuditFindingInput[] = [];
    try {
      const axe = await runAxeAccessibility(auditUrl, chrome, signal);
      axeJson = axe.axeJson;
      axeFindings = axe.findings;
    } catch (axeCause) {
      console.error("web-audit axe failed", strategy, axeCause);
      axeJson = {
        error:
          axeCause instanceof Error ? axeCause.message : String(axeCause),
      };
    }

    return {
      scores,
      axeJson,
      axeFindings,
      snapshot: toSnapshot(scores, axeJson),
    };
  } finally {
    await killAuditChrome(chrome);
  }
};
