import { useMemo, useState } from "react";
import { CheckCircle2, ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PageImageJson, StaticAnalysisJson } from "@/lbs/website-monitor/audit/types";
import {
  TableCell,
  TableRow,
  WebsiteAuditTableShell,
} from "@/lbs/website-monitor/audit/WebsiteAuditTableShell";
import { cn } from "@/lib/utils";

const IMAGE_ISSUE_COPY: Record<string, string> = {
  default: "Falta texto alternativo (alt).",
  hero: "Imagen principal sin alt — describe el negocio.",
  servicio: "Imagen de servicio sin alt.",
  equipo: "Foto de equipo sin alt.",
  logo: "Logo sin alt — usa el nombre de la empresa.",
  broken: "No cargó (URL rota o bloqueada).",
};

const guessIssueCopy = (filename: string | null, status: PageImageJson["status"]) => {
  if (status === "broken") return IMAGE_ISSUE_COPY.broken;
  const name = (filename ?? "").toLowerCase();
  if (name.includes("hero") || name.includes("banner")) return IMAGE_ISSUE_COPY.hero;
  if (name.includes("servicio") || name.includes("service"))
    return IMAGE_ISSUE_COPY.servicio;
  if (name.includes("equipo") || name.includes("team")) return IMAGE_ISSUE_COPY.equipo;
  if (name.includes("logo")) return IMAGE_ISSUE_COPY.logo;
  return IMAGE_ISSUE_COPY.default;
};

type ImageFilter = "all" | "ok" | "missing_alt" | "broken";

const statusBadge = (status: PageImageJson["status"]) => {
  if (status === "ok") return "bg-emerald-100 text-emerald-700";
  if (status === "broken") return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-800";
};

const statusLabel = (status: PageImageJson["status"]) => {
  if (status === "ok") return "OK";
  if (status === "broken") return "Rota";
  return "Sin alt";
};

const ImageThumb = ({ src, alt }: { src: string; alt?: string | null }) => (
  <div className="size-12 shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted">
    {src ? (
      <img
        src={src}
        alt={alt ?? ""}
        className="size-full object-cover"
        loading="lazy"
        onError={(e) => {
          (e.target as HTMLImageElement).style.opacity = "0.2";
        }}
      />
    ) : null}
  </div>
);

export const WebsiteAuditImagesPanel = ({
  staticJson,
}: {
  staticJson: StaticAnalysisJson;
}) => {
  const [filter, setFilter] = useState<ImageFilter>("all");
  const pageImages = staticJson.pageImages ?? [];
  const legacyProblems = staticJson.imagesMissingAlt ?? [];

  const images: PageImageJson[] =
    pageImages.length > 0
      ? pageImages
      : legacyProblems.map((img) => ({
          src: img.src,
          filename: img.filename,
          alt: null,
          status: "missing_alt" as const,
        }));

  const total = staticJson.totalImages ?? images.length;
  const okCount = staticJson.imagesOk ?? images.filter((i) => i.status === "ok").length;
  const missingAlt =
    staticJson.imagesWithoutAlt ??
    images.filter((i) => i.status === "missing_alt").length;
  const brokenCount =
    staticJson.brokenImages ?? images.filter((i) => i.status === "broken").length;

  const filtered = useMemo(
    () =>
      images.filter((image) => {
        if (filter === "all") return true;
        return image.status === filter;
      }),
    [filter, images],
  );

  const filters: Array<{ id: ImageFilter; label: string }> = [
    { id: "all", label: "Todas" },
    { id: "ok", label: "OK" },
    { id: "missing_alt", label: "Sin alt" },
    { id: "broken", label: "Rotas" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Imágenes del sitio</h3>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Inventario con miniatura. Clasificación: OK, sin alt o rota.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary" className="gap-1">
          <ImageIcon className="size-3" />
          {total} imágenes
        </Badge>
        <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
          {okCount} OK
        </Badge>
        {missingAlt > 0 ? (
          <Badge className="gap-1 bg-amber-500 hover:bg-amber-500">
            {missingAlt} sin alt
          </Badge>
        ) : null}
        {brokenCount > 0 ? (
          <Badge variant="destructive">{brokenCount} rotas</Badge>
        ) : null}
      </div>

      {images.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 px-6 py-10 text-center">
          <p className="text-sm font-medium">No se detectaron imágenes</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Regenera el reporte con el worker actualizado.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  filter === item.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/60 text-muted-foreground hover:bg-muted/50",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          {okCount === images.length && filter === "all" ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-800">
              <CheckCircle2 className="size-4 shrink-0" />
              Todas las imágenes revisadas están OK.
            </div>
          ) : null}

          <WebsiteAuditTableShell
            columns={["Vista", "Archivo", "Estado", "Alt", "Observación", "URL"]}
          >
            {filtered.map((image) => (
              <TableRow key={image.src}>
                <TableCell>
                  <ImageThumb src={image.src} alt={image.alt} />
                </TableCell>
                <TableCell className="max-w-[140px] whitespace-normal text-xs font-medium">
                  {image.filename ?? "sin nombre"}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      statusBadge(image.status),
                    )}
                  >
                    {statusLabel(image.status)}
                  </span>
                </TableCell>
                <TableCell className="max-w-[180px] whitespace-normal text-xs text-muted-foreground">
                  {image.alt?.trim() ? image.alt : "—"}
                </TableCell>
                <TableCell className="max-w-[220px] whitespace-normal text-xs text-muted-foreground">
                  {image.status === "ok"
                    ? "Correcta"
                    : guessIssueCopy(image.filename, image.status)}
                </TableCell>
                <TableCell className="max-w-[200px] whitespace-normal">
                  <a
                    href={image.src}
                    target="_blank"
                    rel="noreferrer"
                    className="line-clamp-2 break-all text-[10px] text-primary hover:underline"
                  >
                    {image.src}
                  </a>
                </TableCell>
              </TableRow>
            ))}
          </WebsiteAuditTableShell>

          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ninguna imagen en esta categoría.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
};
