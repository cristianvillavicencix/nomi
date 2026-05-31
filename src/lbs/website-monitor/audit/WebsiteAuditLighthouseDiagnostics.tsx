import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import type {
  LighthouseCategoryStat,
  LighthouseOpportunity,
} from "@/lbs/website-monitor/audit/lighthouseParseUtils";
import { cn } from "@/lib/utils";

const scoreBarColor = (score: number | null) => {
  if (score == null) return "bg-slate-300";
  if (score >= 90) return "bg-emerald-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-red-500";
};

const OpportunityIcon = ({ score }: { score: number | null }) => {
  if (score == null || score >= 0.9) {
    return <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />;
  }
  if (score >= 0.5) {
    return <AlertTriangle className="size-5 shrink-0 text-amber-600" />;
  }
  return <XCircle className="size-5 shrink-0 text-red-600" />;
};

export const WebsiteAuditOpportunitiesList = ({
  opportunities,
  limit,
}: {
  opportunities: LighthouseOpportunity[];
  limit?: number;
}) => {
  const items = limit ? opportunities.slice(0, limit) : opportunities;

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Diagnósticos de oportunidad</h3>
        <p className="text-xs text-muted-foreground">
          Problemas técnicos concretos que, si los arreglas, mejoran la
          velocidad del sitio.
        </p>
      </div>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/60 px-4 py-6 text-sm text-muted-foreground">
          Sin oportunidades de Lighthouse para este dispositivo. Regenera el
          reporte si acabas de actualizar el worker.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-start gap-3 rounded-xl border border-border/60 bg-card px-3 py-3"
            >
              <OpportunityIcon score={item.score} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{item.title}</p>
                {item.description ? (
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                    {item.description}
                  </p>
                ) : null}
              </div>
              {item.savingsMs != null && item.savingsMs > 0 ? (
                <span
                  className={cn(
                    "shrink-0 rounded-md px-2 py-1 text-xs font-semibold tabular-nums",
                    item.score != null && item.score < 0.5
                      ? "bg-red-50 text-red-700"
                      : "bg-amber-50 text-amber-700",
                  )}
                >
                  -{(item.savingsMs / 1000).toFixed(1)} s
                </span>
              ) : item.score != null && item.score >= 0.9 ? (
                <span className="shrink-0 rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                  OK
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export const WebsiteAuditCategoryBars = ({
  categories,
}: {
  categories: LighthouseCategoryStat[];
}) => (
  <section className="space-y-3">
    <div>
      <h3 className="text-sm font-semibold">Categorías evaluadas</h3>
      <p className="text-xs text-muted-foreground">
        Lighthouse revisa cuatro grandes áreas. Aquí el desglose de cuántas
        verificaciones pasaron en cada una.
      </p>
    </div>
    <ul className="space-y-4">
      {categories.map((cat) => (
        <li key={cat.id}>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="text-sm font-medium">{cat.label}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {cat.score ?? "—"}/100
              {cat.total > 0 ? ` · ${cat.passed}/${cat.total} ✓` : ""}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                scoreBarColor(cat.score),
              )}
              style={{ width: `${cat.score ?? 0}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  </section>
);
