import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDataProvider, useNotify } from "ra-core";
import {
  ExternalLink,
  Globe,
  Loader2,
  Lock,
  Mail,
  Shield,
} from "lucide-react";
import { Link } from "react-router";

import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatExpiryLabel,
  formatHostingerStatus,
} from "@/modules/hostinger/hostingerDomainUtils";
import { HostingerDnsHealthBadges } from "@/modules/hostinger/HostingerDnsHealthBadges";
import {
  analyzeHostingerDnsHealth,
  readDomainDnsHealth,
} from "@/modules/hostinger/hostingerDnsHealth";
import {
  getHostingerDomainDnsUrl,
  getHostingerDomainMailboxesUrl,
  getHostingerDomainManageUrl,
} from "@/modules/hostinger/hostingerHpanelLinks";
import { buildSettingsSearchParams } from "@/modules/settings/settingsNavigation";
import type { HostingerDomain } from "@/modules/hostinger/types";
import { getClientShowPath } from "@/app/routing";

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
};

const DetailRow = ({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) => (
  <div className="flex items-start justify-between gap-4 py-2 text-sm">
    <span className="shrink-0 text-muted-foreground">{label}</span>
    <span className="text-right font-medium">{value}</span>
  </div>
);

const formatDnsValues = (
  records?: Array<{ content?: string | null; is_disabled?: boolean | null }> | null,
) => {
  if (!records?.length) return "—";
  return records
    .map((record) => {
      const content = record.content?.trim() || "—";
      return record.is_disabled ? `${content} (disabled)` : content;
    })
    .join(", ");
};

type Props = {
  domain: HostingerDomain | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const HostingerDomainDetailSheet = ({
  domain,
  open,
  onOpenChange,
}: Props) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const queryClient = useQueryClient();

  const detailsQuery = useQuery({
    queryKey: ["hostinger_domain_details", domain?.domain],
    queryFn: () =>
      dataProvider.hostingerGetDomainDetails({ domain: domain!.domain }),
    enabled: open && Boolean(domain?.domain),
    staleTime: 60_000,
  });

  const ownedMutation = useMutation({
    mutationFn: async (nextOwned: boolean) => {
      const record = detailsQuery.data?.cached ?? domain;
      if (!record) {
        throw new Error("Domain not loaded");
      }
      return dataProvider.update("hostinger_domains", {
        id: record.id,
        data: {
          is_owned: nextOwned,
          ...(nextOwned ? { company_id: null } : {}),
        },
        previousData: record,
      });
    },
    onSuccess: () => {
      notify("Domain ownership updated", { type: "success" });
      queryClient.invalidateQueries({ queryKey: ["hostinger_domains"] });
      queryClient.invalidateQueries({
        queryKey: ["hostinger_domain_details", domain?.domain],
      });
    },
    onError: (error: unknown) => {
      notify(
        error instanceof Error ? error.message : "Failed to update ownership",
        { type: "error" },
      );
    },
  });

  if (!domain) return null;

  const details = detailsQuery.data?.details;
  const cached = detailsQuery.data?.cached ?? domain;
  const dnsRecords = detailsQuery.data?.dns_records ?? [];
  const mailboxes = detailsQuery.data?.mailboxes ?? [];
  const hasMailApiToken = detailsQuery.data?.has_mail_api_token === true;
  const isOwned = (detailsQuery.data?.cached ?? domain).is_owned === true;
  const cachedDnsHealth = readDomainDnsHealth(cached);
  const liveDnsHealth =
    dnsRecords.length > 0 ? analyzeHostingerDnsHealth(dnsRecords) : null;
  const dnsHealth = liveDnsHealth ?? cachedDnsHealth;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(50vw,40rem)]">
        <SheetHeader className="space-y-3 border-b px-5 py-4 text-left">
          <div className="flex flex-wrap items-center gap-2 pr-8">
            <SheetTitle className="text-lg">{domain.domain}</SheetTitle>
            <Badge variant="secondary" className="font-normal">
              {formatHostingerStatus(details?.status ?? domain.status)}
            </Badge>
            {!cached.company_id && !isOwned ? (
              <Badge variant="outline" className="font-normal">
                Unassigned
              </Badge>
            ) : null}
            {isOwned ? (
              <Badge variant="default" className="font-normal">
                Ours
              </Badge>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" asChild>
              <a
                href={getHostingerDomainManageUrl(domain.domain)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Manage in hPanel
                <ExternalLink className="ml-1.5 size-3.5" />
              </a>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <a
                href={getHostingerDomainDnsUrl(domain.domain)}
                target="_blank"
                rel="noopener noreferrer"
              >
                DNS in hPanel
                <ExternalLink className="ml-1.5 size-3.5" />
              </a>
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {detailsQuery.isPending ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading domain details…
            </div>
          ) : detailsQuery.isError ? (
            <p className="py-8 text-sm text-destructive">
              {detailsQuery.error instanceof Error
                ? detailsQuery.error.message
                : "Failed to load domain details"}
            </p>
          ) : (
            <div className="space-y-6">
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Ownership</h3>
                <div className="flex items-start justify-between gap-4 rounded-lg border px-4 py-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Our domain</p>
                    <p className="text-xs text-muted-foreground">
                      Mark internal domains that belong to your organization, not
                      a client. Sync also auto-marks your organization website.
                    </p>
                  </div>
                  <Switch
                    checked={isOwned}
                    disabled={ownedMutation.isPending}
                    onCheckedChange={(checked) => ownedMutation.mutate(checked)}
                    aria-label="Mark as our domain"
                  />
                </div>
              </section>

              <section className="space-y-1">
                <h3 className="text-sm font-semibold">Client</h3>
                {isOwned ? (
                  <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                    This is marked as your organization&apos;s domain. Client
                    linking is disabled while &quot;Our domain&quot; is on.
                  </p>
                ) : cached.company_id && cached.company_name ? (
                  <div className="rounded-lg border bg-muted/20 px-4 py-3">
                    <Link
                      to={getClientShowPath(cached.company_id)}
                      className="font-medium hover:underline"
                    >
                      {cached.company_name}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Linked by matching company website to this domain.
                    </p>
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                    No linked client. Add this domain to the company&apos;s
                    website field and sync again to auto-link.
                  </p>
                )}
              </section>

              <section>
                <h3 className="mb-2 text-sm font-semibold">Registration</h3>
                <div className="rounded-lg border px-4 py-1">
                  <DetailRow
                    label="Type"
                    value={details?.type ?? cached.domain_type ?? "—"}
                  />
                  <DetailRow
                    label="Registered"
                    value={formatDateTime(
                      details?.registered_at ?? cached.registered_at,
                    )}
                  />
                  <DetailRow
                    label="Expires"
                    value={
                      <span>
                        {formatDateTime(details?.expires_at ?? cached.expires_at)}
                        <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                          {formatExpiryLabel(details?.expires_at ?? cached.expires_at)}
                        </span>
                      </span>
                    }
                  />
                  <DetailRow
                    label="Last synced"
                    value={formatDateTime(cached.synced_at)}
                  />
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-sm font-semibold">Protection</h3>
                <div className="rounded-lg border px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant={details?.is_locked ? "default" : "secondary"}
                      className="gap-1 font-normal"
                    >
                      <Lock className="size-3" />
                      {details?.is_locked ? "Locked" : "Unlocked"}
                    </Badge>
                    <Badge
                      variant={
                        details?.is_privacy_protected ? "default" : "secondary"
                      }
                      className="gap-1 font-normal"
                    >
                      <Shield className="size-3" />
                      {details?.is_privacy_protected
                        ? "Privacy on"
                        : "Privacy off"}
                    </Badge>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-sm font-semibold">Name servers</h3>
                <div className="rounded-lg border px-4 py-1 font-mono text-sm">
                  <DetailRow
                    label="NS1"
                    value={details?.name_servers?.ns1 ?? "—"}
                  />
                  <DetailRow
                    label="NS2"
                    value={details?.name_servers?.ns2 ?? "—"}
                  />
                </div>
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Email mailboxes</h3>
                  <Mail className="size-4 text-muted-foreground" />
                </div>
                {!hasMailApiToken ? (
                  <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                    Add a Hostinger Mail API token in{" "}
                    <Link
                      to={`/settings?${buildSettingsSearchParams("connectors", "hostinger").toString()}`}
                      className="font-medium underline"
                    >
                      Settings → Integrations → Hostinger
                    </Link>{" "}
                    to list mailboxes here (read-only).
                  </p>
                ) : detailsQuery.data?.mail_error ? (
                  <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-destructive">
                    {detailsQuery.data.mail_error}
                  </p>
                ) : mailboxes.length === 0 ? (
                  <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                    No mailboxes found for this domain. Activate Hostinger Email
                    in hPanel and create addresses under Mailboxes.
                  </p>
                ) : (
                  <div className="space-y-2 rounded-lg border px-4 py-3">
                    <ul className="space-y-1 text-sm font-medium">
                      {mailboxes.map((mailbox) => (
                        <li key={mailbox.resource_id ?? mailbox.address}>
                          {mailbox.address ?? "—"}
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-muted-foreground">
                      {mailboxes.length} mailbox
                      {mailboxes.length === 1 ? "" : "es"} on this domain.
                    </p>
                  </div>
                )}
                <div className="mt-2">
                  <Button variant="secondary" size="sm" asChild>
                    <a
                      href={getHostingerDomainMailboxesUrl(domain.domain)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Manage mailboxes in hPanel
                      <ExternalLink className="ml-1.5 size-3.5" />
                    </a>
                  </Button>
                </div>
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">DNS health</h3>
                  <Globe className="size-4 text-muted-foreground" />
                </div>
                <div className="rounded-lg border px-4 py-3">
                  <HostingerDnsHealthBadges health={dnsHealth} />
                  {dnsHealth?.checked_at ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Checked{" "}
                      {new Date(dnsHealth.checked_at).toLocaleString()}
                      {liveDnsHealth ? " (live)" : " (from last sync)"}
                    </p>
                  ) : null}
                </div>
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">DNS records</h3>
                  <Globe className="size-4 text-muted-foreground" />
                </div>
                {detailsQuery.data?.dns_error ? (
                  <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                    {detailsQuery.data.dns_error}
                  </p>
                ) : dnsRecords.length === 0 ? (
                  <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                    No DNS records returned for this domain.
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Value</TableHead>
                          <TableHead className="w-16 text-right">TTL</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dnsRecords.map((record, index) => (
                          <TableRow key={`${record.type}-${record.name}-${index}`}>
                            <TableCell className="font-mono text-xs">
                              {record.type ?? "—"}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {record.name ?? "@"}
                            </TableCell>
                            <TableCell className="max-w-[12rem] truncate font-mono text-xs">
                              {formatDnsValues(record.records)}
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              {record.ttl ?? "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </section>

              {details?.message ? (
                <>
                  <Separator />
                  <p className="text-xs text-muted-foreground">{details.message}</p>
                </>
              ) : null}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
