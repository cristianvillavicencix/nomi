import { MapPin } from "lucide-react";
import type {
  AuditFinding,
  WebsiteAuditAiSummaryJson,
} from "@/lbs/website-monitor/audit/types";
import { WebsiteAuditAiTextBlock } from "@/lbs/website-monitor/audit/WebsiteAuditAiTextBlock";
import {
  getFindingSourceLabel,
  resolveFindingLocations,
  resolveFindingProblem,
} from "@/lbs/website-monitor/audit/findingDetailUtils";
import type { FindingAiInsight } from "@/lbs/website-monitor/audit/websiteAuditAiUtils";

export const WebsiteAuditFindingDetailSections = ({
  finding,
  aiInsight,
  showCategoryWhy,
  categoryWhy,
}: {
  finding: AuditFinding;
  aiInsight?: FindingAiInsight | null;
  showCategoryWhy?: boolean;
  categoryWhy?: string | null;
}) => {
  const problem = resolveFindingProblem(finding);
  const locations = resolveFindingLocations(finding);
  const sourceLabel = getFindingSourceLabel(finding);

  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-lg border border-border/60 bg-background px-3 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Qué se encontró
        </p>
        <p className="mt-1 font-medium leading-snug">{finding.title}</p>
        {problem && problem !== finding.title ? (
          <p className="mt-2 leading-relaxed text-muted-foreground">
            {problem}
          </p>
        ) : null}
        {finding.metric_value ? (
          <p className="mt-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Medición: </span>
            {finding.metric_value}
            {finding.metric_key ? ` (${finding.metric_key})` : ""}
          </p>
        ) : null}
      </div>

      {locations.length > 0 ? (
        <div className="rounded-lg border border-amber-200/70 bg-amber-50/50 px-3 py-2.5 dark:border-amber-500/20 dark:bg-amber-950/20">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase text-amber-900 dark:text-amber-200">
            <MapPin className="size-3.5 shrink-0" />
            Dónde está el problema
          </p>
          <ul className="mt-2 space-y-1.5">
            {locations.map((loc, index) => (
              <li
                key={`${finding.id}-loc-${index}`}
                className="break-all font-mono text-xs leading-relaxed text-amber-950/90 dark:text-amber-100/90"
              >
                {loc.startsWith("http") ? (
                  <a
                    href={loc}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {loc}
                  </a>
                ) : (
                  loc
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        <span className="font-semibold text-foreground/80">Fuente: </span>
        {sourceLabel}
      </p>

      {aiInsight ? (
        <WebsiteAuditAiTextBlock title="En palabras simples">
          <p>{aiInsight.plain_language}</p>
          {aiInsight.business_impact ? (
            <p className="mt-2 text-xs text-violet-900/75">
              <span className="font-semibold">Impacto: </span>
              {aiInsight.business_impact}
            </p>
          ) : null}
        </WebsiteAuditAiTextBlock>
      ) : null}

      {showCategoryWhy && categoryWhy ? (
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Por qué importa
          </p>
          <p className="mt-1 text-muted-foreground">{categoryWhy}</p>
        </div>
      ) : null}

      {finding.recommendation ? (
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-2">
          <p className="text-xs font-semibold text-emerald-800">
            Cómo corregirlo
          </p>
          <p className="mt-1 leading-relaxed text-emerald-900/90">
            {finding.recommendation}
          </p>
        </div>
      ) : null}

      {finding.commercial_message ? (
        <p className="text-xs italic text-muted-foreground">
          {finding.commercial_message}
        </p>
      ) : null}
    </div>
  );
};
