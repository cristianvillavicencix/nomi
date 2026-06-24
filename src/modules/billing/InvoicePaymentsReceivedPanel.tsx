import { ChevronDown, MoreHorizontal, Receipt } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { formatInvoiceMoney } from "@/modules/billing/invoiceEmailTemplate";
import type { InvoiceDetailPaymentRow } from "@/modules/billing/invoiceDetailPayments";
import type { ClientInvoice } from "@/modules/types";
import { cn } from "@/lib/utils";

type InvoicePaymentsReceivedPanelProps = {
  invoice: ClientInvoice;
  rows: InvoiceDetailPaymentRow[];
  onResendReceipt?: () => void;
  resendPending?: boolean;
  className?: string;
};

const PaymentModeCell = ({
  cardBrand,
  cardLast4,
}: {
  cardBrand?: string | null;
  cardLast4?: string | null;
}) => {
  const brand = cardBrand?.trim();
  const last4 = cardLast4?.trim();

  if (!brand && !last4) {
    return <span className="text-muted-foreground">Stripe</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {brand ? <span className="font-medium capitalize">{brand}</span> : null}
      {last4 ? <span className="text-muted-foreground">····{last4}</span> : null}
      <span className="rounded bg-muted px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        stripe
      </span>
    </div>
  );
};

export const InvoicePaymentsReceivedPanel = ({
  invoice,
  rows,
  onResendReceipt,
  resendPending = false,
  className,
}: InvoicePaymentsReceivedPanelProps) => {
  const currency = invoice.currency ?? "USD";
  const totalReceived = useMemo(
    () => rows.reduce((sum, row) => sum + row.amount, 0),
    [rows],
  );
  const [open, setOpen] = useState(rows.length <= 2);

  if (rows.length === 0) return null;

  const latestRow = rows[0];
  const collapsedSummary = latestRow
    ? `${latestRow.dateLabel} · ${formatInvoiceMoney(latestRow.amount, currency)}`
    : null;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-background shadow-sm",
        className,
      )}
    >
      <Accordion
        type="single"
        collapsible
        value={open ? "payments" : ""}
        onValueChange={(value) => setOpen(value === "payments")}
      >
        <AccordionItem value="payments" className="border-0">
          <AccordionTrigger
            className={cn(
              "group flex w-full items-center gap-2 px-3 py-2.5 hover:no-underline",
              "[&>svg:last-child]:hidden",
            )}
          >
            <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
            <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
              <span className="text-sm font-semibold">Payments Received</span>
              <Badge
                variant="secondary"
                className="h-5 rounded-full px-1.5 text-[10px] font-medium"
              >
                {rows.length}
              </Badge>
              {!open && collapsedSummary ? (
                <span className="truncate text-xs text-muted-foreground">
                  {collapsedSummary}
                </span>
              ) : null}
            </span>
            <span className="shrink-0 text-sm font-semibold tabular-nums">
              {formatInvoiceMoney(totalReceived, currency)}
            </span>
          </AccordionTrigger>

          <AccordionContent className="pb-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-8 px-3 text-xs">Date</TableHead>
                  <TableHead className="h-8 px-3 text-xs">Payment #</TableHead>
                  <TableHead className="hidden h-8 px-3 text-xs md:table-cell">
                    Reference #
                  </TableHead>
                  <TableHead className="h-8 px-3 text-xs">Status</TableHead>
                  <TableHead className="hidden h-8 px-3 text-xs sm:table-cell">
                    Payment mode
                  </TableHead>
                  <TableHead className="h-8 px-3 text-right text-xs">
                    Amount
                  </TableHead>
                  {onResendReceipt ? (
                    <TableHead className="h-8 w-10 px-1" />
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} className="hover:bg-muted/40">
                    <TableCell className="px-3 py-1.5 text-xs text-muted-foreground">
                      {row.dateLabel}
                    </TableCell>
                    <TableCell className="px-3 py-1.5 text-xs font-medium text-primary">
                      {row.paymentNumber}
                    </TableCell>
                    <TableCell className="hidden max-w-[160px] truncate px-3 py-1.5 font-mono text-[11px] text-muted-foreground md:table-cell">
                      {row.reference}
                    </TableCell>
                    <TableCell className="px-3 py-1.5">
                      <Badge
                        variant={row.statusVariant}
                        className={cn(
                          "h-5 px-1.5 text-[10px] font-medium",
                          row.status === "Paid" &&
                            "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                        )}
                      >
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden px-3 py-1.5 sm:table-cell">
                      <PaymentModeCell
                        cardBrand={row.cardBrand}
                        cardLast4={row.cardLast4}
                      />
                    </TableCell>
                    <TableCell className="px-3 py-1.5 text-right text-xs font-medium tabular-nums">
                      {formatInvoiceMoney(row.amount, currency)}
                    </TableCell>
                    {onResendReceipt ? (
                      <TableCell className="px-1 py-1.5 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              aria-label="Payment actions"
                              disabled={resendPending}
                            >
                              <MoreHorizontal className="size-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={onResendReceipt}>
                              <Receipt className="size-4" />
                              Resend receipt
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};
