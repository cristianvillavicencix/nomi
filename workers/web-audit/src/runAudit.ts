import { config } from "./config.js";
import { postCallback, postCallbackSafe } from "./callbackClient.js";
import {
  LighthouseAuditError,
} from "./modules/lighthouseAudit.js";
import { fetchCruxFieldData } from "./modules/cruxFieldData.js";
import { runStrategyPass } from "./modules/runStrategyPass.js";
import {
  runStaticAnalysis,
  StaticAnalysisError,
} from "./modules/staticAnalysis.js";
import { mergeSocialLinks } from "./modules/extractSocialLinks.js";
import { mergePageLinks } from "./modules/extractPageLinks.js";
import { checkPageLinks } from "./modules/checkPageLinks.js";
import { summarizePageImages } from "./modules/extractRenderedPageContent.js";
import { applyMergedSeoAnalysis } from "./modules/mergeSeoAnalysis.js";
import { refreshAiSeoChecklist } from "./modules/staticAnalysis.js";
import { hydrateStaticFromBrowserHtml } from "./modules/hydrateStaticFromBrowserHtml.js";
import {
  applyCrawlFilesToStatic,
  mergeCrawlFilesPreferBrowser,
  type CrawlFilesAnalysisResult,
} from "./modules/crawlFilesAnalysis.js";
import type { RenderedSeoSignals } from "./modules/extractRenderedSeo.js";
import type { StaticAnalysisResult } from "./types.js";
import {
  combineOverallScore,
  mergeFindings,
  mergeUnifiedFindings,
} from "./scoring/mapFindings.js";
import { enrichCommercialMessages } from "./narrative/enrichCommercialMessages.js";
import { markActiveAudit, clearActiveAudit } from "./activeAudit.js";
import type {
  AuditFindingInput,
  WebsiteAuditCallbackPayload,
  WebsiteAuditWorkerJob,
} from "./types.js";

class AuditTimeoutError extends Error {
  readonly code = "timeout";

  constructor() {
    super(
      `El audit superó el límite de ${Math.round(config.timeoutMs / 1000)} segundos.`,
    );
    this.name = "AuditTimeoutError";
  }
}

const classifyFailure = (cause: unknown): { message: string; code: string } => {
  if (cause instanceof AuditTimeoutError) {
    return { message: cause.message, code: cause.code };
  }
  if (cause instanceof StaticAnalysisError) {
    return { message: cause.message, code: cause.code };
  }
  if (cause instanceof LighthouseAuditError) {
    return { message: cause.message, code: cause.code };
  }

  if (
    cause instanceof Error &&
    (cause.name === "AbortError" || cause.message.includes("aborted"))
  ) {
    return {
      message: `El audit superó el límite de ${Math.round(config.timeoutMs / 1000)} segundos.`,
      code: "timeout",
    };
  }

  const message = cause instanceof Error ? cause.message : String(cause);
  return { message: `Audit falló: ${message}`, code: "unknown" };
};

const originOf = (url: string) => {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
};

const withMergedSocialLinks = (
  staticResult: Awaited<ReturnType<typeof runStaticAnalysis>>,
  auditUrl: string,
  ...renderedGroups: Array<
    Array<{ network: string; url: string; label?: string | null }>
  >
) => {
  const pageOrigin = originOf(staticResult.finalUrl ?? auditUrl);
  staticResult.socialLinks = mergeSocialLinks(
    pageOrigin,
    staticResult.socialLinks,
    ...renderedGroups,
  );
  return staticResult;
};

const withMergedPageInventory = async (
  staticResult: StaticAnalysisResult,
  auditUrl: string,
  signal: AbortSignal,
  mobilePass: {
    pageLinks: Array<{
      url: string;
      text?: string | null;
      isInternal: boolean;
      status: number | null;
      ok: boolean;
      error?: string | null;
    }>;
    pageImages: Array<{
      src: string;
      filename: string | null;
      alt: string | null;
      status: "ok" | "missing_alt" | "broken";
      width?: number | null;
      height?: number | null;
    }>;
    totalPageLinks: number;
    brokenLinkCount: number;
    checkedLinkCount: number;
  },
) => {
  const pageOrigin = originOf(staticResult.finalUrl ?? auditUrl);

  if (mobilePass.pageImages.length > 0) {
    const summary = summarizePageImages(
      mobilePass.pageImages.map((img) => ({
        ...img,
        width: img.width ?? null,
        height: img.height ?? null,
      })),
    );
    staticResult.pageImages = summary.pageImages;
    staticResult.totalImages = summary.totalImages;
    staticResult.imagesWithoutAlt = summary.imagesWithoutAlt;
    staticResult.brokenImages = summary.brokenImages;
    staticResult.imagesOk = summary.imagesOk;
    staticResult.imagesMissingAlt = summary.imagesMissingAlt;
  }

  if (mobilePass.pageLinks.length > 0) {
    staticResult.pageLinks = mobilePass.pageLinks;
    staticResult.totalPageLinks = mobilePass.totalPageLinks;
    staticResult.brokenLinkCount = mobilePass.brokenLinkCount;
    staticResult.checkedLinkCount = mobilePass.checkedLinkCount;
    delete staticResult.staticPageLinks;
    return staticResult;
  }

  const merged = mergePageLinks(
    pageOrigin,
    staticResult.staticPageLinks ?? [],
  );
  if (merged.length === 0) {
    staticResult.pageLinks = [];
    staticResult.totalPageLinks = 0;
    staticResult.brokenLinkCount = 0;
    staticResult.checkedLinkCount = 0;
    delete staticResult.staticPageLinks;
    return staticResult;
  }

  const checked = await checkPageLinks(merged, signal);
  staticResult.pageLinks = checked.links;
  staticResult.totalPageLinks = checked.totalLinks;
  staticResult.brokenLinkCount = checked.brokenLinkCount;
  staticResult.checkedLinkCount = checked.checkedCount;
  delete staticResult.staticPageLinks;
  return staticResult;
};

const withMergedSeoAnalysis = (
  staticResult: StaticAnalysisResult,
  renderedSeo: RenderedSeoSignals | null,
) => {
  applyMergedSeoAnalysis({
    staticResult,
    staticHtml: staticResult.sourceHtml ?? "",
    rendered: renderedSeo,
  });
  delete staticResult.sourceHtml;
  return staticResult;
};

const stripInternalStaticFields = (staticResult: StaticAnalysisResult) => {
  delete staticResult.sourceHtml;
  delete staticResult.staticPageLinks;
  return staticResult;
};

const mergeBrowserCrawlFilesIntoStatic = (
  staticResult: StaticAnalysisResult,
  browserCrawl: CrawlFilesAnalysisResult | null,
) => {
  if (!browserCrawl) return;
  const merged = mergeCrawlFilesPreferBrowser(staticResult.crawlFiles, browserCrawl);
  applyCrawlFilesToStatic(staticResult, merged);
};

const recoverStaticAfterWafBlock = async (
  staticResult: StaticAnalysisResult,
  auditUrl: string,
  renderedSeo: RenderedSeoSignals | null,
  signal: AbortSignal,
) => {
  if (!staticResult.staticFetchBlocked || !renderedSeo?.html) {
    if (staticResult.staticFetchBlocked && !renderedSeo?.html) {
      throw new StaticAnalysisError(
        `El sitio bloqueó el fetch automático (HTTP ${staticResult.httpStatus ?? 403}) y Chrome no pudo obtener el HTML. Posible WAF agresivo (Cloudflare, Sucuri, Wordfence).`,
        "bot_protection",
      );
    }
    return;
  }

  const recovered = await hydrateStaticFromBrowserHtml(staticResult, {
    html: renderedSeo.html,
    finalUrl: auditUrl,
    signal,
  });

  if (!recovered) {
    throw new StaticAnalysisError(
      "El sitio bloqueó el fetch automático y tampoco se pudo cargar en Chrome.",
      "bot_protection",
    );
  }
};

const sendTerminalCallback = async (
  callbackUrl: string,
  payload: WebsiteAuditCallbackPayload,
): Promise<void> => {
  await postCallback(callbackUrl, payload);
};

const pingRunning = async (
  job: WebsiteAuditWorkerJob,
  phase: "static" | "mobile" | "desktop" | "crux",
) => {
  await postCallbackSafe(job.callback_url, {
    audit_id: job.audit_id,
    status: "running",
    worker_id: config.workerId,
    strategy: job.strategy,
    progress_phase: phase,
  });
};

const runLegacySingleStrategy = async (
  job: WebsiteAuditWorkerJob,
  signal: AbortSignal,
): Promise<WebsiteAuditCallbackPayload> => {
  if (job.strategy === "unified") {
    throw new Error("use runUnifiedReport for unified strategy");
  }

  const staticResult = await runStaticAnalysis(job.url, signal);
  const auditUrl = staticResult.finalUrl ?? job.url;

  const cruxPromise = fetchCruxFieldData(auditUrl, job.strategy, signal);
  const pass = await runStrategyPass(auditUrl, job.strategy, signal);
  const crux = await cruxPromise;

  withMergedSocialLinks(staticResult, auditUrl, pass.socialLinks);
  await withMergedPageInventory(staticResult, auditUrl, signal, pass);
  await recoverStaticAfterWafBlock(
    staticResult,
    auditUrl,
    pass.renderedSeo,
    signal,
  );
  withMergedSeoAnalysis(staticResult, pass.renderedSeo);
  mergeBrowserCrawlFilesIntoStatic(staticResult, pass.browserCrawlFiles);
  refreshAiSeoChecklist(staticResult);
  stripInternalStaticFields(staticResult);

  const findings = enrichCommercialMessages(
    mergeFindings(staticResult, pass.scores, pass.axeFindings),
  );

  return {
    audit_id: job.audit_id,
    status: "done",
    worker_id: config.workerId,
    strategy: job.strategy,
    overall_score: pass.scores.overall,
    score_performance: pass.scores.performance,
    score_seo: pass.scores.seo,
    score_best_practices: pass.scores.bestPractices,
    score_accessibility: pass.scores.accessibility,
    lab_lcp_ms: pass.scores.labLcpMs,
    lab_cls: pass.scores.labCls,
    lab_tbt_ms: pass.scores.labTbtMs,
    field_lcp_ms: crux.fieldLcpMs,
    field_cls: crux.fieldCls,
    field_inp_ms: crux.fieldInpMs,
    crux_has_data: crux.cruxHasData,
    crux_json: crux.cruxJson,
    static_json: staticResult as unknown as Record<string, unknown>,
    lighthouse_json: null,
    axe_json: pass.axeJson,
    findings,
  };
};

const runUnifiedReport = async (
  job: WebsiteAuditWorkerJob,
  signal: AbortSignal,
): Promise<WebsiteAuditCallbackPayload> => {
  const staticResult = await runStaticAnalysis(job.url, signal);
  const auditUrl = staticResult.finalUrl ?? job.url;
  await pingRunning(job, "static");

  const cruxPromise = fetchCruxFieldData(auditUrl, "mobile", signal);

  // Sequential — one Chrome at a time. Ping BEFORE each pass so UI shows real phase.
  await pingRunning(job, "mobile");
  const mobile = await runStrategyPass(auditUrl, "mobile", signal);

  await pingRunning(job, "desktop");
  const desktop = await runStrategyPass(auditUrl, "desktop", signal);

  const crux = await cruxPromise;
  await pingRunning(job, "crux");

  withMergedSocialLinks(
    staticResult,
    auditUrl,
    mobile.socialLinks,
    desktop.socialLinks,
  );
  await withMergedPageInventory(staticResult, auditUrl, signal, mobile);
  await recoverStaticAfterWafBlock(
    staticResult,
    auditUrl,
    mobile.renderedSeo,
    signal,
  );
  withMergedSeoAnalysis(staticResult, mobile.renderedSeo);
  mergeBrowserCrawlFilesIntoStatic(staticResult, mobile.browserCrawlFiles);
  refreshAiSeoChecklist(staticResult);
  stripInternalStaticFields(staticResult);

  const findings = enrichCommercialMessages(
    mergeUnifiedFindings(
      staticResult,
      mobile.scores,
      mobile.axeFindings,
      desktop.scores,
      desktop.axeFindings,
    ),
  );

  const overall = combineOverallScore(
    mobile.scores.overall,
    desktop.scores.overall,
  );

  return {
    audit_id: job.audit_id,
    status: "done",
    worker_id: config.workerId,
    strategy: "unified",
    overall_score: overall,
    score_performance: mobile.scores.performance,
    score_seo: mobile.scores.seo,
    score_best_practices: mobile.scores.bestPractices,
    score_accessibility: mobile.scores.accessibility,
    lab_lcp_ms: mobile.scores.labLcpMs,
    lab_cls: mobile.scores.labCls,
    lab_tbt_ms: mobile.scores.labTbtMs,
    field_lcp_ms: crux.fieldLcpMs,
    field_cls: crux.fieldCls,
    field_inp_ms: crux.fieldInpMs,
    crux_has_data: crux.cruxHasData,
    crux_json: crux.cruxJson,
    static_json: staticResult as unknown as Record<string, unknown>,
    lighthouse_json: null,
    axe_json: mobile.axeJson,
    mobile_snapshot: mobile.snapshot,
    desktop_snapshot: desktop.snapshot,
    findings,
  };
};

export const runAuditJob = async (job: WebsiteAuditWorkerJob) => {
  let terminalSent = false;
  const controller = new AbortController();
  markActiveAudit(job);

  const failAudit = async (message: string) => {
    if (terminalSent) return;
    await sendTerminalCallback(job.callback_url, {
      audit_id: job.audit_id,
      status: "failed",
      worker_id: config.workerId,
      strategy: job.strategy,
      error_message: message,
    });
    terminalSent = true;
  };

  const timeoutHandle = setTimeout(() => controller.abort(), config.timeoutMs);

  const runWithHardTimeout = async () => {
    await postCallback(job.callback_url, {
      audit_id: job.audit_id,
      status: "running",
      worker_id: config.workerId,
      strategy: job.strategy,
    });

    const payload =
      job.strategy === "unified"
        ? await runUnifiedReport(job, controller.signal)
        : await runLegacySingleStrategy(job, controller.signal);

    await sendTerminalCallback(job.callback_url, payload);
    terminalSent = true;
  };

  try {
    await Promise.race([
      runWithHardTimeout(),
      new Promise<never>((_resolve, reject) => {
        setTimeout(() => reject(new AuditTimeoutError()), config.timeoutMs);
      }),
    ]);
  } catch (cause) {
    const failure = classifyFailure(cause);
    console.error("web-audit failed", job.audit_id, failure.code, failure.message);
    try {
      await failAudit(failure.message);
    } catch (callbackCause) {
      console.error("web-audit failed callback", job.audit_id, callbackCause);
    }
  } finally {
    clearTimeout(timeoutHandle);
    clearActiveAudit();
    if (!terminalSent) {
      await postCallbackSafe(job.callback_url, {
        audit_id: job.audit_id,
        status: "failed",
        worker_id: config.workerId,
        strategy: job.strategy,
        error_message: `El audit terminó sin callback terminal (timeout ${Math.round(config.timeoutMs / 1000)}s).`,
      });
    }
  }
};
