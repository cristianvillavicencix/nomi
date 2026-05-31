import { ExternalLink } from "lucide-react";
import type { StaticAnalysisJson } from "@/lbs/website-monitor/audit/types";
import {
  TableCell,
  TableRow,
  WebsiteAuditTableShell,
} from "@/lbs/website-monitor/audit/WebsiteAuditTableShell";
import {
  getSocialLinkLabel,
  getSocialNetworkOption,
  normalizeSocialUrl,
  resolveSocialNetwork,
  type ClientSocialLinkValue,
} from "@/lbs/clients/clientSocialLinks";

export const WebsiteAuditSocialPanel = ({
  staticJson,
}: {
  staticJson: StaticAnalysisJson;
}) => {
  const links = (staticJson.socialLinks ?? []) as ClientSocialLinkValue[];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Redes sociales detectadas</h3>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Perfiles sociales encontrados en la página (footer, iconos, JSON embebido).
        </p>
      </div>

      {links.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 px-6 py-10 text-center">
          <p className="text-sm font-medium">No se encontraron redes sociales</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Regenera el reporte si acabas de actualizar el worker.
          </p>
        </div>
      ) : (
        <WebsiteAuditTableShell columns={["Red", "Etiqueta", "URL del perfil"]}>
          {links.map((link) => {
            const network = resolveSocialNetwork(link);
            const option = getSocialNetworkOption(network);
            const Icon = option.Icon;
            const href = normalizeSocialUrl(link.url);
            const label = getSocialLinkLabel(link);

            return (
              <TableRow key={`${network}-${href}`}>
                <TableCell className="whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="size-4" />
                    </span>
                    <span className="text-sm font-medium">{option.label}</span>
                  </div>
                </TableCell>
                <TableCell className="max-w-[200px] whitespace-normal text-sm">
                  {label}
                  {link.label && link.label !== label ? (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Texto: {link.label}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="max-w-[320px] whitespace-normal">
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <span className="break-all">{href}</span>
                    <ExternalLink className="size-3 shrink-0" />
                  </a>
                </TableCell>
              </TableRow>
            );
          })}
        </WebsiteAuditTableShell>
      )}
    </div>
  );
};
