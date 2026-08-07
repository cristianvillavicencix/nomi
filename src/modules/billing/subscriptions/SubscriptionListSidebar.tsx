import { useMemo } from "react";
import { useGetMany, useListContext } from "ra-core";
import type { Company, Contact } from "@/components/atomic-crm/types";
import { formatContactName } from "@/modules/billing/billingUtils";
import {
  formatSubscriptionAmountLabel,
  subscriptionMatchesSearchQuery,
  subscriptionMatchesStatusFilter,
  subscriptionStatusLabel,
  subscriptionStatusVariant,
  formatSubscriptionNextBillingLabel,
  type SubscriptionStatusFilter,
} from "@/modules/billing/subscriptions/subscriptionDisplayUtils";
import type { ClientSubscription } from "@/modules/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type SubscriptionListSidebarProps = {
  selectedSubscriptionId?: string | null;
  onSelectSubscription: (subscriptionId: string) => void;
  searchQuery?: string;
  statusFilter?: SubscriptionStatusFilter;
};

export const SubscriptionListSidebar = ({
  selectedSubscriptionId,
  onSelectSubscription,
  searchQuery = "",
  statusFilter = "all",
}: SubscriptionListSidebarProps) => {
  const { data: subscriptions = [], isPending } =
    useListContext<ClientSubscription>();

  const companyIds = useMemo(
    () => [
      ...new Set(
        subscriptions
          .map((row) => row.company_id)
          .filter((id): id is NonNullable<ClientSubscription["company_id"]> =>
            id != null,
          ),
      ),
    ],
    [subscriptions],
  );

  const contactIds = useMemo(
    () => [
      ...new Set(
        subscriptions
          .map((row) => row.contact_id)
          .filter((id): id is NonNullable<ClientSubscription["contact_id"]> =>
            id != null,
          ),
      ),
    ],
    [subscriptions],
  );

  const { data: companies = [] } = useGetMany<Company>(
    "companies",
    { ids: companyIds },
    { enabled: companyIds.length > 0 },
  );
  const { data: contacts = [] } = useGetMany<Contact>(
    "contacts",
    { ids: contactIds },
    { enabled: contactIds.length > 0 },
  );

  const companyById = useMemo(
    () => new Map(companies.map((company) => [String(company.id), company])),
    [companies],
  );
  const contactById = useMemo(
    () => new Map(contacts.map((contact) => [String(contact.id), contact])),
    [contacts],
  );

  const visibleRows = useMemo(
    () =>
      subscriptions.filter((row) => {
        const company = row.company_id
          ? companyById.get(String(row.company_id))
          : null;
        const contact = row.contact_id
          ? contactById.get(String(row.contact_id))
          : null;
        return (
          subscriptionMatchesStatusFilter(row, statusFilter) &&
          subscriptionMatchesSearchQuery(
            row,
            company?.name ?? null,
            formatContactName(contact) ?? null,
            searchQuery,
          )
        );
      }),
    [companyById, contactById, searchQuery, statusFilter, subscriptions],
  );

  if (isPending) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Loading subscriptions…
      </div>
    );
  }

  if (!subscriptions.length) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        No subscriptions yet.
      </div>
    );
  }

  if (!visibleRows.length) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        No subscriptions match this search.
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <ul className="divide-y">
        {visibleRows.map((row) => {
          const company = row.company_id
            ? companyById.get(String(row.company_id))
            : null;
          const contact = row.contact_id
            ? contactById.get(String(row.contact_id))
            : null;
          const isSelected =
            String(row.id) === String(selectedSubscriptionId);
          const clientLabel =
            company?.name ??
            formatContactName(contact) ??
            "No customer";

          return (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => onSelectSubscription(String(row.id))}
                className={cn(
                  "flex w-full flex-col gap-1.5 px-3 py-3 text-left transition-colors hover:bg-muted/40",
                  isSelected &&
                    "bg-primary/5 ring-1 ring-inset ring-primary/20",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-medium">
                    {clientLabel}
                  </span>
                  <span className="shrink-0 text-sm font-medium tabular-nums">
                    {formatSubscriptionAmountLabel(
                      Number(row.amount),
                      row.currency,
                      row.billing_interval,
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-muted-foreground">
                    {row.subscription_number ?? row.name}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                    {formatSubscriptionNextBillingLabel(row)}
                  </span>
                </div>
                <Badge
                  variant={subscriptionStatusVariant(row.status, row)}
                  className="w-fit text-[10px] uppercase tracking-wide"
                >
                  {subscriptionStatusLabel(row.status, row)}
                </Badge>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
