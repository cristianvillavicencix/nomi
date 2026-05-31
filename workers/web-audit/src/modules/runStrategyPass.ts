import { runLighthouseAudit } from "./lighthouseAudit.js";
import { runAxeAccessibility } from "./axeAccessibility.js";
import { checkPageLinks, type PageLinkChecked } from "./checkPageLinks.js";
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
import type { SocialLinkFound } from "./extractSocialLinks.js";
import type { RenderedSeoSignals } from "./extractRenderedSeo.js";
import type { PageImageFound } from "./extractRenderedPageContent.js";
import type { CrawlFilesAnalysisResult } from "./crawlFilesAnalysis.js";

export type StrategyPassResult = {
  scores: LighthouseScores;
  axeJson: Record<string, unknown> | null;
  axeFindings: AuditFindingInput[];
  socialLinks: SocialLinkFound[];
  pageLinks: PageLinkChecked[];
  pageImages: PageImageFound[];
  totalPageLinks: number;
  brokenLinkCount: number;
  checkedLinkCount: number;
  renderedSeo: RenderedSeoSignals | null;
  browserCrawlFiles: CrawlFilesAnalysisResult | null;
  snapshot: AuditStrategySnapshot;
};

import { trimLighthouseJson } from "./trimLighthouseJson.js";

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
  lab_fcp_ms: scores.labFcpMs,
  lab_cls: scores.labCls,
  lab_tbt_ms: scores.labTbtMs,
  lighthouse_json: trimLighthouseJson(scores.lighthouseJson),
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

  const emptyLinks: PageLinkChecked[] = [];
  const emptyImages: PageImageFound[] = [];

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
    let socialLinks: SocialLinkFound[] = [];
    let pageLinks: PageLinkChecked[] = emptyLinks;
    let pageImages: PageImageFound[] = emptyImages;
    let totalPageLinks = 0;
    let brokenLinkCount = 0;
    let checkedLinkCount = 0;
    let renderedSeo: RenderedSeoSignals | null = null;
    let browserCrawlFiles: CrawlFilesAnalysisResult | null = null;

    try {
      const axe = await runAxeAccessibility(auditUrl, chrome, signal);
      axeJson = axe.axeJson;
      axeFindings = axe.findings;
      socialLinks = axe.socialLinks;
      pageImages = axe.pageImages;
      renderedSeo = axe.renderedSeo;
      browserCrawlFiles = axe.browserCrawlFiles;

      if (strategy === "mobile" && axe.pageLinks.length > 0) {
        const checked = await checkPageLinks(axe.pageLinks, signal);
        pageLinks = checked.links;
        totalPageLinks = checked.totalLinks;
        brokenLinkCount = checked.brokenLinkCount;
        checkedLinkCount = checked.checkedCount;
      }
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
      socialLinks,
      pageLinks,
      pageImages,
      totalPageLinks,
      brokenLinkCount,
      checkedLinkCount,
      renderedSeo,
      browserCrawlFiles,
      snapshot: toSnapshot(scores, axeJson),
    };
  } finally {
    await killAuditChrome(chrome);
  }
};
