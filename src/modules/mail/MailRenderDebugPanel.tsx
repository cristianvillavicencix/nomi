import { cn } from "@/lib/utils";
import {
  analyzeMailRenderPipeline,
  type MailRenderDebugReport,
} from "./mailRenderDebug";
import { MAIL_STYLESHEET_ALLOWLIST_HINT } from "./mailRenderAllowlist";

function Row({
  label,
  value,
  warn,
}: {
  label: string;
  value: string | number;
  warn?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3 text-[11px] leading-snug">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-mono tabular-nums",
          warn ? "text-amber-700 dark:text-amber-400" : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function MailRenderDebugPanel({
  rawHtml,
  className,
}: {
  rawHtml: string;
  className?: string;
}) {
  const report: MailRenderDebugReport = analyzeMailRenderPipeline(rawHtml);

  return (
    <div
      className={cn(
        "border-b border-amber-200/80 bg-amber-50/90 px-3 py-2 font-sans text-foreground dark:border-amber-900/50 dark:bg-amber-950/40",
        className,
      )}
    >
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
        Mail render debug (dev)
      </p>
      <div className="grid gap-0.5 sm:grid-cols-2">
        <Row label="Raw HTML" value={`${report.rawBytes} B`} />
        <Row label="Sanitized body" value={`${report.sanitizedBodyBytes} B`} />
        <Row label="Extracted CSS" value={`${report.extractedStyleBytes} B`} />
        <Row label="Tables" value={report.tableCount} />
        <Row label="Images (https)" value={`${report.imgHttpsCount}/${report.imgCount}`} />
        <Row
          label="Font links OK"
          value={report.styleLinkCountAllowed}
        />
        <Row
          label="Font links blocked"
          value={report.styleLinkCountBlocked}
          warn={report.styleLinkCountBlocked > 0}
        />
        <Row label="cid:" value={report.cidCount} warn={report.cidCount > 0} />
        <Row label="Nested bodies" value={report.nestedBodyCount} />
      </div>
      {report.warnings.length > 0 ? (
        <ul className="mt-2 space-y-0.5 text-[11px] text-amber-900 dark:text-amber-200">
          {report.warnings.map((w) => (
            <li key={w.code}>
              <span className="font-mono text-[10px]">{w.code}</span>: {w.message}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[11px] text-emerald-800 dark:text-emerald-300">
          No pipeline warnings for this message.
        </p>
      )}
      {report.blockedStylesheetHrefs.length > 0 ? (
        <p className="mt-1 truncate text-[10px] text-amber-900/90 dark:text-amber-200/90" title={report.blockedStylesheetHrefs.join("\n")}>
          Blocked: {report.blockedStylesheetHrefs.slice(0, 2).join(" · ")}
          {report.blockedStylesheetHrefs.length > 2 ? " · …" : ""}
        </p>
      ) : null}
      <p className="mt-1.5 text-[10px] text-muted-foreground">
        Allowlist: {MAIL_STYLESHEET_ALLOWLIST_HINT}
      </p>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Toggle: localStorage{" "}
        <code className="rounded bg-black/5 px-1">nomi-mail-render-debug=1</code> or{" "}
        <code className="rounded bg-black/5 px-1">?mailDebug=1</code>
      </p>
    </div>
  );
}
