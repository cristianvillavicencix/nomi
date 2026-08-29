import { useMemo } from "react";
import { Link } from "react-router";
import { useGetMany } from "ra-core";
import type { Company, Contact, Deal } from "@/components/atomic-crm/types";
import { getClientShowPath } from "@/app/routing";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const WON_STAGES = new Set(["won", "closed_won", "delivered"]);

type ContactRelatedAccountsProps = {
  contact: Contact;
  deals: Deal[];
  className?: string;
};

type AccountRow = {
  companyId: number | string;
  name: string;
  isPrimary: boolean;
  dealCount: number;
  wonCount: number;
};

/**
 * Lists every Account this person appears on (primary company + deals).
 * Useful when one person has worked across several clients.
 */
export const ContactRelatedAccounts = ({
  contact,
  deals,
  className,
}: ContactRelatedAccountsProps) => {
  const accountIds = useMemo(() => {
    const ids = new Set<string | number>();
    if (contact.company_id != null) ids.add(contact.company_id);
    for (const deal of deals) {
      if (deal.company_id != null) ids.add(deal.company_id);
    }
    return Array.from(ids);
  }, [contact.company_id, deals]);

  const { data: companies = [] } = useGetMany<Company>(
    "companies",
    { ids: accountIds },
    { enabled: accountIds.length > 0 },
  );

  const rows = useMemo((): AccountRow[] => {
    const byId = new Map(companies.map((c) => [String(c.id), c]));
    return accountIds.map((id) => {
      const company = byId.get(String(id));
      const relatedDeals = deals.filter(
        (deal) => String(deal.company_id) === String(id),
      );
      const wonCount = relatedDeals.filter((deal) =>
        WON_STAGES.has(String(deal.stage ?? "").toLowerCase()),
      ).length;
      const isPrimary = String(contact.company_id) === String(id);
      const name =
        (isPrimary && contact.company_name?.trim()) ||
        company?.name?.trim() ||
        "Account";
      return {
        companyId: id,
        name,
        isPrimary,
        dealCount: relatedDeals.length,
        wonCount,
      };
    });
  }, [accountIds, companies, contact.company_id, contact.company_name, deals]);

  if (rows.length <= 1) return null;

  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-muted/20 px-4 py-3",
        className,
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">
          {rows.length === 1 ? "Account" : "Accounts worked with"}
        </p>
        {rows.length > 1 ? (
          <span className="text-xs text-muted-foreground">
            {rows.length} accounts
          </span>
        ) : null}
      </div>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li
            key={String(row.companyId)}
            className="flex flex-wrap items-center gap-2 text-sm"
          >
            <Link
              to={getClientShowPath(row.companyId)}
              className="link-action font-medium text-foreground"
            >
              {row.name}
            </Link>
            {row.isPrimary ? (
              <Badge variant="outline" className="text-[10px]">
                Primary
              </Badge>
            ) : null}
            <span className="text-xs text-muted-foreground">
              {row.dealCount === 0
                ? "No deals yet"
                : `${row.dealCount} deal${row.dealCount === 1 ? "" : "s"}`}
              {row.wonCount > 0
                ? ` · ${row.wonCount} won`
                : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
