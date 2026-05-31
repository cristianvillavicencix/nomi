import { ExternalLink, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { StaticAnalysisJson } from "@/lbs/website-monitor/audit/types";
import {
  TableCell,
  TableRow,
  WebsiteAuditTableShell,
} from "@/lbs/website-monitor/audit/WebsiteAuditTableShell";

export const WebsiteAuditTechStackPanel = ({
  staticJson,
}: {
  staticJson: StaticAnalysisJson;
}) => {
  const technologies = staticJson.technologies ?? [];

  if (technologies.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 px-6 py-10 text-center">
        <Layers className="mx-auto mb-3 size-8 text-muted-foreground/60" />
        <p className="text-sm font-medium">Stack tecnológico no detectado</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Regenera el reporte con el worker actualizado. Wappalyzer analiza HTML
          y headers HTTP para identificar CMS, frameworks, analytics y CDN.
        </p>
      </div>
    );
  }

  const categories = [
    ...new Set(technologies.flatMap((tech) => tech.categories)),
  ].sort();

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Stack tecnológico</h3>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {technologies.length} tecnologías detectadas con Wappalyzer (HTML +
          headers). Útil para entender CMS, hosting, analytics y frameworks.
        </p>
      </div>

      {categories.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <Badge key={category} variant="secondary" className="text-xs">
              {category}
            </Badge>
          ))}
        </div>
      ) : null}

      <WebsiteAuditTableShell
        columns={["Tecnología", "Versión", "Categorías", "Confianza", ""]}
      >
        {technologies.map((tech) => (
          <TableRow key={tech.name}>
            <TableCell className="font-medium">{tech.name}</TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {tech.version ?? "—"}
            </TableCell>
            <TableCell className="max-w-[220px] whitespace-normal text-xs">
              {tech.categories.length > 0 ? tech.categories.join(", ") : "—"}
            </TableCell>
            <TableCell className="text-xs tabular-nums text-muted-foreground">
              {tech.confidence}%
            </TableCell>
            <TableCell className="text-right">
              {tech.website ? (
                <a
                  href={tech.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Web
                  <ExternalLink className="size-3" />
                </a>
              ) : (
                "—"
              )}
            </TableCell>
          </TableRow>
        ))}
      </WebsiteAuditTableShell>
    </div>
  );
};
