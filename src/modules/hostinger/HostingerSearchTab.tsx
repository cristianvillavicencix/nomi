import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useDataProvider, useNotify } from "ra-core";
import { ExternalLink, Loader2, Search, ShoppingCart } from "lucide-react";

import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type {
  HostingerAvailabilityResult,
  HostingerAvailabilitySearchResponse,
} from "@/components/atomic-crm/providers/supabase/modules/hostingerProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  buildHostingerReferralPurchaseUrl,
  formatHostingerPrice,
  getHostingerBuyInHpanelUrl,
} from "@/modules/hostinger/hostingerPurchaseLinks";

const parseDomainLabel = (raw: string) => {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return "";
  const withoutProtocol = trimmed.replace(/^https?:\/\//, "");
  const withoutWww = withoutProtocol.replace(/^www\./, "");
  const label = withoutWww.split("/")[0]?.split(".")[0] ?? "";
  return label.replace(/[^a-z0-9-]/g, "");
};

export const HostingerSearchTab = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const [query, setQuery] = useState("");
  const [searchMeta, setSearchMeta] =
    useState<HostingerAvailabilitySearchResponse | null>(null);

  const searchMutation = useMutation({
    mutationFn: async (rawQuery: string) => {
      const label = parseDomainLabel(rawQuery);
      if (!label) {
        throw new Error("Enter a valid domain name");
      }
      return dataProvider.hostingerCheckAvailability({ domain: label });
    },
    onSuccess: (data) => {
      setSearchMeta(data);
      if ((data.results ?? []).length === 0) {
        notify("No availability results returned", { type: "warning" });
      }
    },
    onError: (error: unknown) => {
      notify(error instanceof Error ? error.message : "Search failed", {
        type: "error",
      });
    },
  });

  const results = searchMeta?.results ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Domain availability</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Check pricing and availability across common TLDs. Buy opens
            Hostinger checkout in a new tab. Promotional multi-year prices may
            differ slightly at checkout.
          </p>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              searchMutation.mutate(query);
            }}
          >
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="example or mybusiness"
            />
            <Button type="submit" disabled={searchMutation.isPending}>
              {searchMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              <span className="sr-only">Search</span>
            </Button>
          </form>
        </CardContent>
      </Card>

      {results.length > 0 ? (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Intro price</TableHead>
                <TableHead>Renews at</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((result, index) => (
                <AvailabilityRow
                  key={result.domain ?? `result-${index}`}
                  result={result}
                  referralCode={searchMeta?.referral_code}
                  referralLinkTemplate={searchMeta?.referral_link_template}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  );
};

const AvailabilityRow = ({
  result,
  referralCode,
  referralLinkTemplate,
}: {
  result: HostingerAvailabilityResult;
  referralCode?: string | null;
  referralLinkTemplate?: string | null;
}) => {
  const domain = result.domain ?? "—";
  const currency = result.currency ?? "USD";
  const available = result.is_available === true;
  const buyUrl = domain !== "—" ? getHostingerBuyInHpanelUrl(domain) : null;
  const referralUrl =
    domain !== "—" && available
      ? buildHostingerReferralPurchaseUrl(domain, {
          referralCode,
          referralLinkTemplate,
        })
      : null;

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{domain}</div>
        {result.is_alternative ? (
          <Badge variant="outline" className="mt-1 font-normal">
            Alternative
          </Badge>
        ) : null}
        {result.restriction ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {result.restriction}
          </p>
        ) : null}
      </TableCell>
      <TableCell>
        <Badge variant={available ? "default" : "secondary"}>
          {available ? "Available" : "Taken"}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="text-sm font-medium">
          {result.is_promotional ? (
            <span className="text-emerald-700 dark:text-emerald-400">From </span>
          ) : null}
          {formatHostingerPrice(result.first_period_price_cents, currency)}
        </div>
        {result.period_label ? (
          <div className="text-xs text-muted-foreground">
            {result.period_label}
            {result.is_promotional ? " promo" : null}
          </div>
        ) : null}
      </TableCell>
      <TableCell className="text-sm">
        {formatHostingerPrice(result.renewal_price_cents, currency)}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex flex-wrap justify-end gap-2">
          {available && buyUrl ? (
            <Button variant="primary" size="sm" asChild>
              <a
                href={buyUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.stopPropagation()}
              >
                <ShoppingCart className="mr-1.5 size-3.5" />
                Buy
              </a>
            </Button>
          ) : null}
          {available && referralUrl && referralCode ? (
            <Button variant="secondary" size="sm" asChild>
              <a
                href={referralUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.stopPropagation()}
              >
                Referral
                <ExternalLink className="ml-1.5 size-3.5" />
              </a>
            </Button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
};
