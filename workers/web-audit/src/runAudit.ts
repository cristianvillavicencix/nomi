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
import {
  combineOverallScore,
  mergeFindings,
  mergeUnifiedFindings,
} from "./scoring/mapFindings.js";
import { enrichCommercialMessages } from "./narrative/enrichCommercialMessages.js";
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

const sendTerminalCallback = async (
  callbackUrl: string,
  payload: WebsiteAuditCallbackPayload,
): Promise<void> => {
  await postCallback(callbackUrl, payload);
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
    lighthouse_json: pass.scores.lighthouseJson,
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

  const cruxPromise = fetchCruxFieldData(auditUrl, "mobile", signal);

  const mobile = await runStrategyPass(auditUrl, "mobile", signal);
  const desktop = await runStrategyPass(auditUrl, "desktop", signal);
  const crux = await cruxPromise;

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
    lighthouse_json: mobile.scores.lighthouseJson,
    axe_json: mobile.axeJson,
    mobile_snapshot: mobile.snapshot,
    desktop_snapshot: desktop.snapshot,
    findings,
  };
};

export const runAuditJob = async (job: WebsiteAuditWorkerJob) => {
  let terminalSent = false;
  const controller = new AbortController();

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
