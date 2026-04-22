import { useMemo, useRef, useState } from "react";
import {
  useDelete,
  useGetMany,
  useListContext,
  useNotify,
  useRefresh,
} from "ra-core";
import { Link, useNavigate } from "react-router";
import {
  ArrowDown,
  ArrowUp,
  FolderKanban,
  MoreHorizontal,
  Pencil,
  Trash,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Company, Contact, Deal, Sale } from "../types";
import { getStageColor, getStageLabel } from "./pipelines";

type SortField = "stage" | "amount" | "updated_at" | "created_at";
type SortOrder = "ASC" | "DESC";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export const DealTableView = () => {
  const navigate = useNavigate();
  const notify = useNotify();
  const refresh = useRefresh();
  const config = useConfigurationContext();
  const { data: deals = [], isPending } = useListContext<Deal>();
  const [sortField, setSortField] = useState<SortField>("updated_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("DESC");
  const [deleteOne, { isPending: isDeleting }] = useDelete<Deal>();
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const companyIds = useMemo(
    () => Array.from(new Set(deals.map((deal) => deal.company_id).filter(Boolean))),
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
  const salesIds = useMemo(
    () =>
      Array.from(
        new Set(
          deals
            .map((deal) => deal.sales_id)
            .filter((salesId): salesId is NonNullable<typeof salesId> =>
              salesId != null,
            ),
        ),
      ),
    [deals],
  );

  const { data: companies = [] } = useGetMany<Company>(
    "companies",
    { ids: companyIds },
    { enabled: companyIds.length > 0 },
  );
  const { data: contacts = [] } = useGetMany<Contact>(
    "contacts_summary",
    { ids: primaryContactIds },
    { enabled: primaryContactIds.length > 0 },
  );
  const { data: sales = [] } = useGetMany<Sale>(
    "sales",
    { ids: salesIds },
    { enabled: salesIds.length > 0 },
  );

  const companiesById = useMemo(
    () => Object.fromEntries(companies.map((company) => [company.id, company])),
    [companies],
  );
  const contactsById = useMemo(
    () => Object.fromEntries(contacts.map((contact) => [contact.id, contact])),
    [contacts],
  );
  const salesById = useMemo(
    () => Object.fromEntries(sales.map((sale) => [sale.id, sale])),
    [sales],
  );
  const sortedDeals = useMemo(() => {
    const records = [...deals];
    records.sort((left, right) => {
      const stageLeft = getStageLabel(config, left.stage, left.pipeline_id);
      const stageRight = getStageLabel(config, right.stage, right.pipeline_id);

      const values: Record<SortField, string | number> = {
        amount: Number(left.amount ?? 0) - Number(right.amount ?? 0),
        created_at:
          new Date(left.created_at ?? 0).getTime() -
          new Date(right.created_at ?? 0).getTime(),
        stage: stageLeft.localeCompare(stageRight),
        updated_at:
          new Date(left.updated_at ?? 0).getTime() -
          new Date(right.updated_at ?? 0).getTime(),
      };

      const comparison = values[sortField];
      const result =
        typeof comparison === "number"
          ? comparison
          : stageLeft.localeCompare(stageRight);

      return sortOrder === "ASC" ? result : -result;
    });
    return records;
  }, [config, deals, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((current) => (current === "ASC" ? "DESC" : "ASC"));
      return;
    }
    setSortField(field);
    setSortOrder(field === "stage" ? "ASC" : "DESC");
  };

  const handleRowClick = (dealId: Deal["id"]) => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }
    clickTimeoutRef.current = setTimeout(() => {
      navigate(`/deals/${dealId}/show`, {
        state: { _scrollToTop: false },
      });
      clickTimeoutRef.current = null;
    }, 220);
  };

  const handleRowDoubleClick = (dealId: Deal["id"]) => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
    navigate(`/deals/${dealId}`, {
      state: { _scrollToTop: false },
    });
  };

  const handleDelete = (deal: Deal) => {
    deleteOne(
      "deals",
      { id: deal.id, previousData: deal },
      {
        onSuccess: () => {
          notify("Project deleted", { type: "info", undoable: false });
          refresh();
        },
        onError: () => {
          notify("Error: project not deleted", { type: "error" });
        },
      },
    );
  };

  if (isPending) return null;

  if (!sortedDeals.length) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
        <h3 className="text-lg font-semibold">No projects found</h3>
        <p className="text-sm text-muted-foreground">
          Try another filter or create a new project.
        </p>
        <Link
          to="/deals/create"
          className={buttonVariants({ variant: "default" })}
        >
          New Project
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader className="sticky top-0 bg-background">
          <TableRow>
            <TableHead>Project</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Contact</TableHead>
            <SortableHead
              label="Stage"
              field="stage"
              sortField={sortField}
              sortOrder={sortOrder}
              onSort={handleSort}
            />
            <SortableHead
              label="Value"
              field="amount"
              sortField={sortField}
              sortOrder={sortOrder}
              onSort={handleSort}
              className="text-right"
            />
            <TableHead>Assigned</TableHead>
            <SortableHead
              label="Updated"
              field="updated_at"
              sortField={sortField}
              sortOrder={sortOrder}
              onSort={handleSort}
              className="hidden xl:table-cell"
            />
            <SortableHead
              label="Created"
              field="created_at"
              sortField={sortField}
              sortOrder={sortOrder}
              onSort={handleSort}
              className="hidden 2xl:table-cell"
            />
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedDeals.map((deal) => {
            const company = companiesById[deal.company_id];
            const primaryContact = deal.contact_ids?.[0]
              ? contactsById[deal.contact_ids[0]]
              : undefined;
            const assignedSale = salesById[deal.sales_id];

            return (
              <TableRow
                key={deal.id}
                className="cursor-pointer"
                onClick={() => handleRowClick(deal.id)}
                onDoubleClick={() => handleRowDoubleClick(deal.id)}
              >
                <TableCell className="max-w-[280px]">
                  <Link
                    to={`/deals/${deal.id}/show`}
                    className="link-action block truncate font-medium"
                    onClick={stopPropagation}
                  >
                    {deal.name || "—"}
                  </Link>
                </TableCell>
                <TableCell className="max-w-[220px]">
                  {company ? (
                    <Link
                      to={`/companies/${company.id}/show`}
                      className="link-action block truncate"
                      onClick={stopPropagation}
                    >
                      {company.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="max-w-[220px]">
                  {primaryContact ? (
                    <Link
                      to={`/contacts/${primaryContact.id}/show`}
                      className="link-action block truncate"
                      onClick={stopPropagation}
                    >
                      {[primaryContact.first_name, primaryContact.last_name]
                        .filter(Boolean)
                        .join(" ") || "—"}
                    </Link>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    style={{
                      backgroundColor: `${getStageColor(
                        config,
                        deal.stage,
                        deal.pipeline_id,
                      )}22`,
                      borderColor: getStageColor(config, deal.stage, deal.pipeline_id),
                    }}
                  >
                    {getStageLabel(config, deal.stage, deal.pipeline_id)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {currencyFormatter.format(Number(deal.amount ?? 0))}
                </TableCell>
                <TableCell className="max-w-[180px]">
                  <span className="block truncate">
                    {assignedSale
                      ? [assignedSale.first_name, assignedSale.last_name]
                          .filter(Boolean)
                          .join(" ")
                      : "—"}
                  </span>
                </TableCell>
                <TableCell className="hidden xl:table-cell">
                  {formatDate(deal.updated_at)}
                </TableCell>
                <TableCell className="hidden 2xl:table-cell">
                  {formatDate(deal.created_at)}
                </TableCell>
                <TableCell onClick={stopPropagation}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link to={`/deals/${deal.id}/show`} onClick={stopPropagation}>
                          <FolderKanban className="size-4" />
                          Open
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to={`/deals/${deal.id}`} onClick={stopPropagation}>
                          <Pencil className="size-4" />
                          Edit
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={isDeleting}
                        onClick={() => handleDelete(deal)}
                      >
                        <Trash className="size-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

const SortableHead = ({
  label,
  field,
  sortField,
  sortOrder,
  onSort,
  className,
}: {
  label: string;
  field: SortField;
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  className?: string;
}) => (
  <TableHead className={className}>
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1 text-left font-medium text-foreground hover:text-primary",
        className?.includes("text-right") && "ml-auto flex",
      )}
      onClick={() => onSort(field)}
    >
      {label}
      {sortField === field ? (
        sortOrder === "ASC" ? (
          <ArrowUp className="size-4" />
        ) : (
          <ArrowDown className="size-4" />
        )
      ) : null}
    </button>
  </TableHead>
);

const formatDate = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
};

const stopPropagation = (event: React.SyntheticEvent) => {
  event.stopPropagation();
};
