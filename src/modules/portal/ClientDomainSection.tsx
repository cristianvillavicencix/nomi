import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PortalCopy } from "@/modules/portal/portalI18n";

const normalizeHref = (url?: string | null) => {
  const raw = url?.trim() ?? "";
  if (!raw) return "";
  return raw.startsWith("http") ? raw : `https://${raw}`;
};

const UrlRow = ({
  label,
  url,
  copy,
}: {
  label: string;
  url: string;
  copy: PortalCopy;
}) => {
  const href = normalizeHref(url);
  if (!href) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background/80 px-4 py-3">
      <div className="min-w-0">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 truncate text-sm font-medium text-brand-navy">{url}</div>
      </div>
      <Button asChild size="sm" variant="outline" className="shrink-0">
        <a href={href} target="_blank" rel="noreferrer">
          <ExternalLink className="size-4" />
          {copy.openLive}
        </a>
      </Button>
    </div>
  );
};

export const ClientDomainSection = ({
  siteUrl,
  stagingUrl,
  copy,
}: {
  siteUrl?: string | null;
  stagingUrl?: string | null;
  copy: PortalCopy;
}) => {
  const rows = [
    { label: copy.liveUrl, url: siteUrl },
    { label: copy.stagingUrl, url: stagingUrl },
  ].filter((row) => Boolean(row.url?.trim()));

  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        {copy.noDomainInfo}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <UrlRow key={row.label} label={row.label} url={row.url!} copy={copy} />
      ))}
    </div>
  );
};
