import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  LighthouseCategoryStat,
  LighthouseOpportunity,
} from "@/lbs/website-monitor/audit/lighthouseParseUtils";
import {
  WebsiteAuditCategoryBars,
  WebsiteAuditOpportunitiesList,
} from "@/lbs/website-monitor/audit/WebsiteAuditLighthouseDiagnostics";

export const WebsiteAuditHtmlDialog = ({
  open,
  onOpenChange,
  deviceLabel,
  opportunities,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deviceLabel: string;
  opportunities: LighthouseOpportunity[];
  categories: LighthouseCategoryStat[];
}) => {
  const copySummary = () => {
    const lines = [
      `Informe auditoría HTML — ${deviceLabel}`,
      "",
      "Diagnósticos de oportunidad:",
      ...opportunities.map(
        (o) =>
          `- ${o.title}${o.savingsMs != null ? ` (${Math.round(o.savingsMs)} ms)` : ""}`,
      ),
      "",
      "Categorías:",
      ...categories.map(
        (c) => `- ${c.label}: ${c.score ?? "—"}/100 (${c.passed}/${c.total} ✓)`,
      ),
    ];
    void navigator.clipboard.writeText(lines.join("\n"));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-base font-semibold">
              Informe auditoría · HTML · {deviceLabel}
            </DialogTitle>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={copySummary}
            >
              <Copy className="mr-1 size-4" />
              Copiar
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6 overflow-y-auto px-4 py-4">
          <WebsiteAuditOpportunitiesList opportunities={opportunities} />
          <WebsiteAuditCategoryBars categories={categories} />
        </div>
      </DialogContent>
    </Dialog>
  );
};
