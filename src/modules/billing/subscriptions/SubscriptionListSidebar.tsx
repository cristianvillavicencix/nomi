import { useMemo } from "react";
import { useGetMany, useListContext } from "ra-core";
import type { Company, Contact } from "@/components/atomic-crm/types";
import { formatBillingDate } from "@/modules/billing/billingDisplayUtils";
import {
  formatSubscriptionAmountLabel,
  subscriptionMatchesSearchQuery,
  subscriptionStatusLabel,
  subscriptionStatusVariant,
} from "@/modules/billing/subscriptions/subscriptionDisplayUtils";
import { formatContactName } from "@/modules/billing/billingUtils";
import type { ClientSubscription } from "@/modules/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type SubscriptionListSidebarProps = {
  selectedSubscriptionId?: string | null;
  onSelectSubscription: (subscriptionId: string) => void;
  searchQuery?: string;
};

export const SubscriptionListSidebar = ({
  selectedSubscriptionId,
  onSelectSubscription,
  searchQuery = "",
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
        return subscriptionMatchesSearchQuery(
          row,
          company?.name ?? null,
          formatContactName(contact) ?? null,
          searchQuery,
        );
      }),
    [companyById, contactById, searchQuery, subscriptions],
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
            "Client";

          return (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => onSelectSubscription(String(row.id))}
                className={cn(
                  "flex w-full flex-col gap-1 px-3 py-3 text-left transition-colors hover:bg-muted/50",
                  isSelected && "bg-muted/60",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {row.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {clientLabel}
                    </p>
                  </div>
                  <Badge variant={subscriptionStatusVariant(row.status)}>
                    {subscriptionStatusLabel(row.status)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {formatSubscriptionAmountLabel(
                      Number(row.amount),
                      row.currency,
                      row.billing_interval,
                    )}
                  </span>
                  <span>
                    Next: {formatBillingDate(row.next_billing_at?.slice(0, 10))}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
