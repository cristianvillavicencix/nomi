import { useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, Link2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  PageLinkJson,
  StaticAnalysisJson,
  WebsiteAuditAiSummaryJson,
} from "@/lbs/website-monitor/audit/types";
import { WebsiteAuditAiTextBlock } from "@/lbs/website-monitor/audit/WebsiteAuditAiTextBlock";
import {
  TableCell,
  TableRow,
  WebsiteAuditTableShell,
} from "@/lbs/website-monitor/audit/WebsiteAuditTableShell";
import { getLinksNarrative } from "@/lbs/website-monitor/audit/websiteAuditAiUtils";
import { cn } from "@/lib/utils";

type LinkFilter = "all" | "ok" | "broken" | "internal" | "external";

const statusLabel = (link: PageLinkJson) => {
  if (link.ok) return "Activo";
  if (link.status != null) return `HTTP ${link.status}`;
  return link.error ?? "Error";
};

const LINK_FILTER_OPTIONS: Array<{ value: LinkFilter; label: string }> = [
  { value: "all", label: "Todos los enlaces" },
  { value: "broken", label: "Solo rotos" },
  { value: "ok", label: "Solo activos" },
  { value: "internal", label: "Solo internos" },
  { value: "external", label: "Solo externos" },
];

export const WebsiteAuditLinksPanel = ({
  staticJson,
  aiSummary,
}: {
  staticJson: StaticAnalysisJson;
  auditUrl?: string;
  aiSummary?: WebsiteAuditAiSummaryJson | null;
}) => {
  const [filter, setFilter] = useState<LinkFilter>("all");
  const links = staticJson.pageLinks ?? [];
  const total = staticJson.totalPageLinks ?? links.length;
  const broken =
    staticJson.brokenLinkCount ?? links.filter((l) => !l.ok).length;
  const checked = staticJson.checkedLinkCount ?? links.length;
  const linksNarrative = getLinksNarrative(aiSummary);

  const filtered = useMemo(
    () =>
      links.filter((link) => {
        if (filter === "ok") return link.ok;
        if (filter === "broken") return !link.ok;
        if (filter === "internal") return link.isInternal;
        if (filter === "external") return !link.isInternal;
        return true;
      }),
    [filter, links],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Enlaces de la página</h3>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Verificados: {checked} de {total}.
          </p>
        </div>
        {links.length > 0 ? (
          <Select
            value={filter}
            onValueChange={(value) => setFilter(value as LinkFilter)}
          >
            <SelectTrigger className="h-9 w-[180px]" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LINK_FILTER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {linksNarrative ? (
        <WebsiteAuditAiTextBlock title="Interpretación de enlaces">
          <p>{linksNarrative}</p>
        </WebsiteAuditAiTextBlock>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary" className="gap-1">
          <Link2 className="size-3" />
          {total} detectados
        </Badge>
        <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
          <CheckCircle2 className="size-3" />
          {links.filter((l) => l.ok).length} activos
        </Badge>
        {broken > 0 ? (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="size-3" />
            {broken} rotos
          </Badge>
        ) : null}
      </div>

      {links.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 px-6 py-10 text-center">
          <p className="text-sm font-medium">No se encontraron enlaces</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Regenera el reporte con el worker actualizado.
          </p>
        </div>
      ) : (
        <>
          <WebsiteAuditTableShell
            columns={["Estado", "Tipo", "Texto del enlace", "URL", "Detalle"]}
          >
            {filtered.map((link) => (
              <TableRow key={link.url}>
                <TableCell className="whitespace-nowrap">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      link.ok
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700",
                    )}
                  >
                    {link.ok ? (
                      <CheckCircle2 className="size-3" />
                    ) : (
                      <XCircle className="size-3" />
                    )}
                    {statusLabel(link)}
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs">
                  {link.isInternal ? "Interno" : "Externo"}
                </TableCell>
                <TableCell className="max-w-[200px] whitespace-normal text-sm">
                  {link.text ?? "—"}
                </TableCell>
                <TableCell className="max-w-[280px] whitespace-normal">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <span className="line-clamp-2 break-all">{link.url}</span>
                    <ExternalLink className="size-3 shrink-0" />
                  </a>
                </TableCell>
                <TableCell className="max-w-[160px] whitespace-normal text-xs text-muted-foreground">
                  {!link.ok && link.error ? link.error : "—"}
                </TableCell>
              </TableRow>
            ))}
          </WebsiteAuditTableShell>

          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ningún enlace con este filtro.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
};
