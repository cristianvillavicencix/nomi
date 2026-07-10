import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDataProvider } from "ra-core";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Globe,
  Search,
  Settings2,
} from "lucide-react";
import { Link } from "react-router";

import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  ATTENTION_EXPIRING_DAYS,
  formatExpiryLabel,
  formatHostingerStatus,
  isExpiredDomain,
  isExpiringWithinDays,
  matchesHostingerDomainFilter,
} from "@/modules/hostinger/hostingerDomainUtils";
import { readDomainDnsHealth } from "@/modules/hostinger/hostingerDnsHealth";
import { HostingerDnsHealthBadges } from "@/modules/hostinger/HostingerDnsHealthBadges";
import {
  getHostingerDomainManageUrl,
  getHostingerHpanelHomeUrl,
} from "@/modules/hostinger/hostingerHpanelLinks";
import type {
  HostingerDomain,
  HostingerDomainFilter,
} from "@/modules/hostinger/types";
import { HostingerDomainDetailSheet } from "@/modules/hostinger/HostingerDomainDetailSheet";
import { getClientShowPath } from "@/app/routing";
import { buildSettingsSearchParams } from "@/modules/settings/settingsNavigation";

const QUICK_FILTERS: {
  value: HostingerDomainFilter;
  label: string;
  tone?: "warning" | "danger";
}[] = [
  { value: "all", label: "All" },
  { value: "expiring_14", label: `${ATTENTION_EXPIRING_DAYS}d`, tone: "warning" },
  { value: "expired", label: "Expired", tone: "danger" },
  { value: "unlinked", label: "Unassigned" },
  { value: "clients", label: "Clients" },
];

const MORE_FILTERS: {
  value: HostingerDomainFilter;
  label: string;
}[] = [
  { value: "expiring_30", label: "Exp. 30d" },
  { value: "expiring_60", label: "Exp. 60d" },
  { value: "expiring_90", label: "Exp. 90d" },
  { value: "active", label: "Active" },
];

const PER_PAGE_OPTIONS = [10, 25, 50, 100] as const;

const formatExpiresAt = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
};

const isMoreFilter = (filter: HostingerDomainFilter) =>
  MORE_FILTERS.some((option) => option.value === filter);

const getDomainRowClass = (domain: HostingerDomain) => {
  if (isExpiredDomain(domain)) {
    return "bg-destructive/5 hover:bg-destructive/10";
  }
  if (isExpiringWithinDays(domain, ATTENTION_EXPIRING_DAYS)) {
    return "bg-amber-500/5 hover:bg-amber-500/10";
  }
  return undefined;
};

const FilterChip = ({
  label,
  count,
  active,
  tone,
  onClick,
}: {
  label: string;
  count: number;
  active?: boolean;
  tone?: "warning" | "danger";
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors",
      active
        ? "border-primary bg-primary text-primary-foreground"
        : "bg-background hover:bg-muted/60",
      !active && tone === "warning" && count > 0 && "border-amber-500/40",
      !active && tone === "danger" && count > 0 && "border-destructive/40",
    )}
  >
    <span>{label}</span>
    <span
      className={cn(
        "tabular-nums",
        active ? "text-primary-foreground/80" : "text-muted-foreground",
      )}
    >
      {count}
    </span>
  </button>
);

export const HostingerDomainsTab = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [filter, setFilter] = useState<HostingerDomainFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<number>(25);
  const [selectedDomain, setSelectedDomain] = useState<HostingerDomain | null>(
    null,
  );
  const [detailOpen, setDetailOpen] = useState(false);

  const settingsQuery = useQuery({
    queryKey: ["hostinger_settings"],
    queryFn: () => dataProvider.getHostingerSettings(),
  });

  const domainsQuery = useQuery({
    queryKey: ["hostinger_domains", "list"],
    queryFn: async () => {
      const response = await dataProvider.getList<HostingerDomain>(
        "hostinger_domains",
        {
          pagination: { page: 1, perPage: 500 },
          sort: { field: "expires_at", order: "ASC" },
          filter: {},
        },
      );
      return response.data;
    },
    enabled: settingsQuery.data?.has_api_token === true,
  });

  const domains = domainsQuery.data ?? [];

  const filterCounts = useMemo(() => {
    const allFilters = [...QUICK_FILTERS, ...MORE_FILTERS];
    return allFilters.reduce(
      (counts, option) => {
        counts[option.value] = domains.filter((domain) =>
          matchesHostingerDomainFilter(domain, option.value),
        ).length;
        return counts;
      },
      {} as Record<HostingerDomainFilter, number>,
    );
  }, [domains]);

  const moreFilterValue = isMoreFilter(filter) ? filter : "none";

  const filteredDomains = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return domains.filter((domain) => {
      if (!matchesHostingerDomainFilter(domain, filter)) return false;
      if (!needle) return true;
      return (
        domain.domain.toLowerCase().includes(needle) ||
        domain.company_name?.toLowerCase().includes(needle)
      );
    });
  }, [domains, filter, search]);

  const total = filteredDomains.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const pageStart = total === 0 ? 0 : (page - 1) * perPage + 1;
  const pageEnd = Math.min(page * perPage, total);

  const paginatedDomains = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredDomains.slice(start, start + perPage);
  }, [filteredDomains, page, perPage]);

  useEffect(() => {
    setPage(1);
  }, [filter, search, perPage]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const openDomainDetails = (domain: HostingerDomain) => {
    setSelectedDomain(domain);
    setDetailOpen(true);
  };

  if (settingsQuery.isLoading) {
    return (
      <p className="text-sm text-muted-foreground">Loading domains…</p>
    );
  }

  if (!settingsQuery.data?.has_api_token) {
    return (
      <Alert>
        <AlertDescription>
          Connect your Hostinger API token in{" "}
          <Link
            to={`/settings?${buildSettingsSearchParams("connectors", "hostinger").toString()}`}
            className="font-medium underline"
          >
            Settings → Integrations → Hostinger
          </Link>{" "}
          to sync your domain portfolio.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {settingsQuery.data.last_sync_error ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>
            Last sync failed: {settingsQuery.data.last_sync_error}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2 rounded-lg border bg-muted/20 p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search domain or client…"
            className="h-9 border-0 bg-background pl-8 shadow-none"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          <div className="flex shrink-0 items-center gap-1">
            {QUICK_FILTERS.map((option) => (
              <FilterChip
                key={option.value}
                label={option.label}
                count={filterCounts[option.value] ?? 0}
                active={filter === option.value}
                tone={option.tone}
                onClick={() => setFilter(option.value)}
              />
            ))}
          </div>

          <Select
            value={moreFilterValue}
            onValueChange={(value) => {
              if (value === "none") {
                setFilter("all");
                return;
              }
              setFilter(value as HostingerDomainFilter);
            }}
          >
            <SelectTrigger className="h-8 w-[7.5rem] shrink-0 border-dashed text-xs">
              <SelectValue placeholder="More" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">More filters</SelectItem>
              {MORE_FILTERS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label} ({filterCounts[option.value] ?? 0})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="ml-auto flex shrink-0 items-center gap-1">
            {settingsQuery.data.last_synced_at ? (
              <span
                className="hidden whitespace-nowrap text-[11px] text-muted-foreground lg:inline"
                title={new Date(
                  settingsQuery.data.last_synced_at,
                ).toLocaleString()}
              >
                Synced{" "}
                {new Date(settingsQuery.data.last_synced_at).toLocaleDateString()}
              </span>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              asChild
              title="Open hPanel"
            >
              <a
                href={getHostingerHpanelHomeUrl()}
                target="_blank"
                rel="noreferrer"
              >
                <Globe className="size-4" />
              </a>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              asChild
              title="Integration settings"
            >
              <Link
                to={`/settings?${buildSettingsSearchParams("connectors", "hostinger").toString()}`}
              >
                <Settings2 className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Domain</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>DNS</TableHead>
              <TableHead>Client</TableHead>
              <TableHead className="w-[120px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {domainsQuery.isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  Loading domains…
                </TableCell>
              </TableRow>
            ) : paginatedDomains.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No domains match this filter. Sync your portfolio from
                  Settings → Integrations → Hostinger.
                </TableCell>
              </TableRow>
            ) : (
              paginatedDomains.map((domain) => (
                <TableRow
                  key={domain.id}
                  className={cn("cursor-pointer", getDomainRowClass(domain))}
                  onClick={() => openDomainDetails(domain)}
                >
                  <TableCell className="font-medium">
                    <button
                      type="button"
                      className="text-left hover:underline"
                      onClick={(event) => {
                        event.stopPropagation();
                        openDomainDetails(domain);
                      }}
                    >
                      {domain.domain}
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary" className="font-normal">
                        {formatHostingerStatus(domain.status)}
                      </Badge>
                      {!domain.company_id && !domain.is_owned ? (
                        <Badge variant="outline" className="font-normal">
                          Unassigned
                        </Badge>
                      ) : null}
                      {domain.is_owned ? (
                        <Badge variant="default" className="font-normal">
                          Ours
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {formatExpiresAt(domain.expires_at)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatExpiryLabel(domain.expires_at)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <HostingerDnsHealthBadges
                      health={readDomainDnsHealth(domain)}
                      compact
                    />
                  </TableCell>
                  <TableCell onClick={(event) => event.stopPropagation()}>
                    {domain.company_id && domain.company_name ? (
                      <Link
                        to={getClientShowPath(domain.company_id)}
                        className="text-sm font-medium hover:underline"
                      >
                        {domain.company_name}
                      </Link>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        No linked client
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      onClick={(event) => event.stopPropagation()}
                    >
                      <a
                        href={getHostingerDomainManageUrl(domain.domain)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        hPanel
                        <ExternalLink className="ml-1.5 size-3.5" />
                      </a>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {!domainsQuery.isLoading && total > 0 ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {pageStart}–{pageEnd} of {total}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Rows</span>
              <Select
                value={String(perPage)}
                onValueChange={(value) => setPerPage(Number(value))}
              >
                <SelectTrigger className="h-8 w-[72px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PER_PAGE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                aria-label="Previous page"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="min-w-[4.5rem] text-center text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8"
                disabled={page >= totalPages}
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                aria-label="Next page"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <HostingerDomainDetailSheet
        domain={selectedDomain}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
};
