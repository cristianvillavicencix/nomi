import { useMemo } from "react";
import { useGetMany, useListContext } from "ra-core";
import type { Company, Contact } from "@/components/atomic-crm/types";
import { formatBillingDate } from "@/modules/billing/billingDisplayUtils";
import {
  formatContactName,
} from "@/modules/billing/billingUtils";
import {
  resolveBillingRecipientEmail,
} from "@/modules/billing/billingRecipientResolution";
import {
  formatSubscriptionAmountLabel,
  subscriptionMatchesSearchQuery,
  subscriptionMatchesStatusFilter,
  subscriptionStatusLabel,
  subscriptionStatusVariant,
  type SubscriptionStatusFilter,
} from "@/modules/billing/subscriptions/subscriptionDisplayUtils";
import type { ClientSubscription } from "@/modules/types";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type SubscriptionListTableProps = {
  selectedSubscriptionId?: string | null;
  onSelectSubscription: (subscriptionId: string) => void;
  searchQuery?: string;
  statusFilter?: SubscriptionStatusFilter;
};

export const SubscriptionListTable = ({
  selectedSubscriptionId,
  onSelectSubscription,
  searchQuery = "",
  statusFilter = "all",
}: SubscriptionListTableProps) => {
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
      <div className="p-8 text-center text-sm text-muted-foreground">
        No subscriptions yet.
      </div>
    );
  }

  if (!visibleRows.length) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        No subscriptions match this search.
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <Table className="min-w-[1100px]">
        <TableHeader className="sticky top-0 z-10 bg-background">
          <TableRow>
            <TableHead>Created</TableHead>
            <TableHead>Activated</TableHead>
            <TableHead>Subscription #</TableHead>
            <TableHead className="min-w-[180px]">Customer</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Last billed</TableHead>
            <TableHead>Next billing</TableHead>
            <TableHead>Reference #</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
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
            const email = resolveBillingRecipientEmail({ company, contact });

            return (
              <TableRow
                key={String(row.id)}
                data-state={isSelected ? "selected" : undefined}
                onClick={() => onSelectSubscription(String(row.id))}
                className={cn("cursor-pointer", isSelected && "bg-primary/5")}
              >
                <TableCell className="text-muted-foreground">
                  {formatBillingDate(row.created_at?.slice(0, 10))}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatBillingDate(row.activated_at?.slice(0, 10))}
                </TableCell>
                <TableCell className="font-medium text-primary">
                  {row.subscription_number ?? `#${row.id}`}
                </TableCell>
                <TableCell>
                  <div className="font-medium">{clientLabel}</div>
                  {email ? (
                    <div className="text-xs text-muted-foreground">{email}</div>
                  ) : null}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.name}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={subscriptionStatusVariant(row.status, row)}
                    className="text-[10px] uppercase tracking-wide"
                  >
                    {subscriptionStatusLabel(row.status, row)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatSubscriptionAmountLabel(
                    Number(row.amount),
                    row.currency,
                    row.billing_interval,
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatBillingDate(row.last_billed_at?.slice(0, 10))}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatBillingDate(row.next_billing_at?.slice(0, 10))}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.reference_number ?? "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
