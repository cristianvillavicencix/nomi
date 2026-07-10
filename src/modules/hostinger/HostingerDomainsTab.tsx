import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDataProvider } from "ra-core";
import { ChevronLeft, ChevronRight, ExternalLink, Search } from "lucide-react";
import { Link } from "react-router";

import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
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
import {
  formatExpiryLabel,
  formatHostingerStatus,
  matchesHostingerDomainFilter,
} from "@/modules/hostinger/hostingerDomainUtils";
import { getHostingerDomainManageUrl } from "@/modules/hostinger/hostingerHpanelLinks";
import type {
  HostingerDomain,
  HostingerDomainFilter,
} from "@/modules/hostinger/types";
import { HostingerDomainDetailSheet } from "@/modules/hostinger/HostingerDomainDetailSheet";
import { getClientShowPath } from "@/app/routing";

const FILTER_OPTIONS: { value: HostingerDomainFilter; label: string }[] = [
  { value: "all", label: "All domains" },
  { value: "expiring_30", label: "Expiring in 30 days" },
  { value: "expiring_60", label: "Expiring in 60 days" },
  { value: "expiring_90", label: "Expiring in 90 days" },
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
  { value: "unlinked", label: "Unlinked" },
];

const PER_PAGE_OPTIONS = [10, 25, 50, 100] as const;

const formatExpiresAt = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
};

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
  });

  const filteredDomains = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (domainsQuery.data ?? []).filter((domain) => {
      if (!matchesHostingerDomainFilter(domain, filter)) return false;
      if (!needle) return true;
      return (
        domain.domain.toLowerCase().includes(needle) ||
        domain.company_name?.toLowerCase().includes(needle)
      );
    });
  }, [domainsQuery.data, filter, search]);

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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search domain or client…"
            className="pl-9"
          />
        </div>
        <Select
          value={filter}
          onValueChange={(value) => setFilter(value as HostingerDomainFilter)}
        >
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            {FILTER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Domain</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Client</TableHead>
              <TableHead className="w-[120px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {domainsQuery.isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  Loading domains…
                </TableCell>
              </TableRow>
            ) : paginatedDomains.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
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
                  className="cursor-pointer"
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
                      {!domain.company_id ? (
                        <Badge variant="outline" className="font-normal">
                          Unlinked
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{formatExpiresAt(domain.expires_at)}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatExpiryLabel(domain.expires_at)}
                    </div>
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
