import { ArrowDown, ArrowUp, Minus, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AuditComparisonResult } from "@/lbs/website-monitor/audit/auditComparison";
import { cn } from "@/lib/utils";

const DeltaBadge = ({ delta }: { delta: number | null }) => {
  if (delta == null)
    return <Minus className="size-3.5 text-muted-foreground" />;
  if (delta === 0) {
    return <span className="text-xs text-muted-foreground">sin cambio</span>;
  }
  const up = delta > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums",
        up ? "text-emerald-600" : "text-red-600",
      )}
    >
      {up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      {up ? `+${delta}` : delta}
    </span>
  );
};

export const WebsiteAuditComparisonPanel = ({
  comparison,
  previousDate,
}: {
  comparison: AuditComparisonResult;
  previousDate?: string | null;
}) => {
  if (!comparison.hasPrevious) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 px-6 py-8 text-center">
        <TrendingUp className="mx-auto mb-3 size-8 text-muted-foreground/60" />
        <p className="text-sm font-medium">Sin reporte anterior</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Genera un segundo audit para ver evolución de scores, hallazgos y
          archivos críticos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-base font-semibold">
          Comparativa vs reporte anterior
        </h3>
        {previousDate ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Comparado con audit del {previousDate}
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {comparison.metrics.map((metric) => (
          <div
            key={metric.key}
            className="rounded-xl border border-border/60 bg-card p-4"
          >
            <p className="text-xs font-medium text-muted-foreground">
              {metric.label}
            </p>
            <div className="mt-2 flex items-end justify-between gap-2">
              <span className="text-2xl font-bold tabular-nums">
                {metric.current ?? "—"}
              </span>
              <DeltaBadge delta={metric.delta} />
            </div>
            {metric.previous != null ? (
              <p className="mt-1 text-xs text-muted-foreground">
                antes: {metric.previous}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      {comparison.crawlChanges.length > 0 ? (
        <div>
          <p className="mb-2 text-sm font-semibold">Archivos críticos</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {comparison.crawlChanges.map((change) => (
              <div
                key={change.label}
                className="rounded-lg border border-border/50 px-3 py-2 text-sm"
              >
                <p className="font-medium">{change.label}</p>
                <p className="text-xs text-muted-foreground">
                  {change.before} → {change.after}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-semibold">
            Nuevos hallazgos ({comparison.newFindings.length})
          </p>
          {comparison.newFindings.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ninguno nuevo</p>
          ) : (
            <ul className="space-y-2">
              {comparison.newFindings.map((item) => (
                <li
                  key={item.sourceId}
                  className="rounded-lg border border-red-200/60 bg-red-50/50 px-3 py-2 text-sm dark:border-red-900 dark:bg-red-950/20"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span>{item.title}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {item.severity}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold">
            Resueltos ({comparison.resolvedFindings.length})
          </p>
          {comparison.resolvedFindings.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ninguno resuelto</p>
          ) : (
            <ul className="space-y-2">
              {comparison.resolvedFindings.map((item) => (
                <li
                  key={item.sourceId}
                  className="rounded-lg border border-emerald-200/60 bg-emerald-50/50 px-3 py-2 text-sm dark:border-emerald-900 dark:bg-emerald-950/20"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span>{item.title}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {item.severity}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
