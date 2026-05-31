import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import type { LighthouseAuditIssue } from "@/lbs/website-monitor/audit/lighthouseParseUtils";
import { CATEGORY_SCORE_EXPLAIN } from "@/lbs/website-monitor/audit/lighthouseParseUtils";
import { cn } from "@/lib/utils";

const RATING_LABEL: Record<string, string> = {
  failed: "Falló",
  warning: "Mejorable",
  passed: "OK",
};

export const WebsiteAuditCategoryDetailPanel = ({
  categoryId,
  categoryLabel,
  score,
  passed,
  total,
  issues,
}: {
  categoryId: string;
  categoryLabel: string;
  score: number | null;
  passed: number;
  total: number;
  issues: LighthouseAuditIssue[];
}) => {
  const explain = CATEGORY_SCORE_EXPLAIN[categoryId] ?? "";

  return (
    <section className="space-y-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div>
        <h4 className="text-sm font-semibold">
          Detalle: {categoryLabel}{" "}
          {score != null ? (
            <span className="text-primary">({score}/100)</span>
          ) : null}
        </h4>
        {explain ? (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            <strong className="text-foreground">Cómo se calcula: </strong>
            {explain}
            {total > 0 ? ` En esta prueba pasaron ${passed} de ${total} auditorías.` : ""}
          </p>
        ) : null}
      </div>

      {issues.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800">
          <CheckCircle2 className="size-4 shrink-0" />
          Sin problemas detectados en esta categoría (o regenera el reporte para ver
          el desglose Lighthouse).
        </div>
      ) : (
        <ul className="space-y-3">
          {issues.map((issue) => (
            <li
              key={issue.id}
              className="rounded-xl border border-border/60 bg-card p-4 shadow-sm"
            >
              <div className="flex items-start gap-2">
                {issue.status === "failed" ? (
                  <XCircle className="mt-0.5 size-4 shrink-0 text-red-600" />
                ) : (
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                )}
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{issue.title}</p>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold",
                        issue.status === "failed"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-800",
                      )}
                    >
                      {RATING_LABEL[issue.status]}
                    </span>
                    {issue.weight != null && issue.weight > 0 ? (
                      <span className="text-[10px] text-muted-foreground">
                        peso {issue.weight}
                      </span>
                    ) : null}
                  </div>

                  {issue.displayValue ? (
                    <p className="text-xs font-medium text-muted-foreground">
                      Medición: {issue.displayValue}
                    </p>
                  ) : null}

                  {issue.description ? (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {issue.description}
                    </p>
                  ) : null}

                  {issue.locations.length > 0 ? (
                    <div className="rounded-lg bg-muted/50 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                        Dónde / qué recurso
                      </p>
                      <ul className="mt-1 space-y-0.5 text-xs text-foreground/90">
                        {issue.locations.map((loc) => (
                          <li key={loc} className="break-all font-mono">
                            {loc}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {issue.savingsMs != null && issue.savingsMs > 0 ? (
                    <p className="text-xs text-amber-700">
                      Ahorro estimado al corregir: ~
                      {(issue.savingsMs / 1000).toFixed(1)} s
                    </p>
                  ) : null}

                  <p className="text-[10px] text-muted-foreground">
                    Regla Lighthouse: <code>{issue.id}</code>
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
