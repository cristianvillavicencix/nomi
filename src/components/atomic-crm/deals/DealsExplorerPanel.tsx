import { format } from "date-fns";
import { PanelLeftClose, PanelRightOpen, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useGetList, useGetMany, useStore } from "ra-core";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Contact, Deal, OrganizationMember } from "../types";
import { getStageColor, getStageLabel } from "./pipelines";

export const DealsExplorerPanel = ({ currentDealId }: { currentDealId: string }) => {
  const config = useConfigurationContext();
  const [query, setQuery] = useState("");
  const [minimized, setMinimized] = useStore<boolean>(
    "app.preferences.dealsExplorerMinimized",
    false,
  );

  const { data: deals = [], isPending } = useGetList<Deal>(
    "deals",
    {
      filter: { "archived_at@is": null },
      pagination: { page: 1, perPage: 200 },
      sort: { field: "updated_at", order: "DESC" },
    },
    { enabled: !!currentDealId, staleTime: 30_000 },
  );

  const salesIds = useMemo(
    () =>
      Array.from(
        new Set(
          deals
            .map((deal) => deal.organization_member_id)
            .filter((salesId): salesId is NonNullable<typeof salesId> =>
              salesId != null,
            ),
        ),
      ),
    [deals],
  );

  const primaryContactIds = useMemo(
    () =>
      Array.from(
        new Set(
          deals
            .map((deal) => deal.contact_ids?.[0])
            .filter((contactId): contactId is NonNullable<typeof contactId> =>
              contactId != null,
            ),
        ),
      ),
    [deals],
  );

  const { data: sales = [] } = useGetMany<OrganizationMember>(
    "organization_members",
    { ids: salesIds },
    { enabled: salesIds.length > 0 },
  );
  const { data: contacts = [] } = useGetMany<Contact>(
    "contacts_summary",
    { ids: primaryContactIds },
    { enabled: primaryContactIds.length > 0 },
  );

  const salesById = useMemo(
    () => Object.fromEntries(sales.map((sale) => [String(sale.id), sale])),
    [sales],
  );
  const contactsById = useMemo(
    () => Object.fromEntries(contacts.map((contact) => [String(contact.id), contact])),
    [contacts],
  );

  const filteredDeals = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return deals;
    return deals.filter((deal) => (deal.name || "").toLowerCase().includes(term));
  }, [deals, query]);

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }),
    [],
  );

  if (minimized) {
    return (
      <aside className="hidden xl:flex h-full w-12 shrink-0 flex-col bg-transparent items-center py-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMinimized(false)}
          aria-label="Expand projects panel"
          title="Expand projects panel"
        >
          <PanelRightOpen className="h-4 w-4" />
        </Button>
        <span className="mt-4 text-[10px] uppercase tracking-wide text-muted-foreground [writing-mode:vertical-rl] rotate-180">
          Quick navigation
        </span>
      </aside>
    );
  }

  return (
    <aside className="hidden xl:flex h-full w-[22rem] shrink-0 flex-col bg-transparent">
      <div className="px-3 py-3 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Projects</h3>
            <p className="text-xs text-muted-foreground">Quick navigation</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMinimized(true)}
            aria-label="Minimize projects panel"
            title="Minimize projects panel"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search projects (${deals.length})`}
            className="h-9 pl-8"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {isPending ? (
          <div className="space-y-2 p-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : filteredDeals.length === 0 ? (
          <div className="p-3 text-sm text-muted-foreground">No projects found.</div>
        ) : (
          <div className="p-2 space-y-1.5">
            {filteredDeals.map((deal) => {
              const isCurrent = String(deal.id) === String(currentDealId);
              const stageLabel = getStageLabel(config, deal.stage, deal.pipeline_id);
              const stageColor = getStageColor(config, deal.stage, deal.pipeline_id);
              const updatedDate = deal.updated_at
                ? format(new Date(deal.updated_at), "MMM d, yyyy")
                : "—";
              const ownerContact = deal.contact_ids?.[0]
                ? contactsById[String(deal.contact_ids[0])]
                : undefined;
              const ownerName = ownerContact
                ? [ownerContact.first_name, ownerContact.last_name]
                    .filter(Boolean)
                    .join(" ")
                : "—";
              const manager = deal.organization_member_id
                ? salesById[String(deal.organization_member_id)]
                : undefined;
              const managerName = manager
                ? [manager.first_name, manager.last_name].filter(Boolean).join(" ")
                : "—";

              return (
                <Link
                  key={deal.id}
                  to={`/deals/${deal.id}/show`}
                  className={cn(
                    "block rounded-md border px-2.5 py-2 text-sm no-underline transition-colors",
                    isCurrent
                      ? "bg-secondary/70 border-secondary text-secondary-foreground"
                      : "hover:bg-muted/60",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="truncate font-medium">
                      {deal.name || `Project #${deal.id}`}
                    </div>
                    <Badge
                      variant="secondary"
                      className="max-w-[120px] shrink-0 truncate border-0 shadow-none"
                      style={{
                        backgroundColor: `${stageColor}22`,
                      }}
                    >
                      {stageLabel}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <div className="text-xs text-muted-foreground truncate">
                      Owner: {ownerName}
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0">{updatedDate}</div>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <div className="text-xs text-muted-foreground truncate">
                      In charge: {managerName}
                    </div>
                    <div className="text-xs font-medium shrink-0">
                      {currencyFormatter.format(Number(deal.amount || 0))}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};
