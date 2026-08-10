import { Plus, Trash2 } from "lucide-react";
import { useGetList } from "ra-core";
import {
  BillToClientSearch,
  type BillToSelection,
} from "@/modules/billing/BillToClientSearch";
import { CatalogLineItemField } from "@/modules/billing/CatalogLineItemField";
import {
  formatOrganizationMemberName,
  formatBillToNameLine,
  resolveBillToDisplay,
} from "@/modules/billing/billingUtils";
import {
  resolveInvoiceBalanceDue,
  resolveInvoiceDisplayTotals,
  type InvoiceDisplaySource,
} from "@/modules/billing/invoiceDisplayTotals";
import type { InvoicePaymentCollectionMode } from "@/modules/billing/invoicePaymentUtils";
import {
  formatInvoicePaymentMethod,
} from "@/modules/billing/invoicePaymentUtils";
import {
  describeInvoiceOnlinePaymentSummary,
  type InvoiceRemainderScheduleConfig,
} from "@/modules/billing/invoiceRemainderSchedule";
import {
  invoiceLineTotal,
  newInvoiceLineKey,
  STRIPE_TRANSFER_FEE_LABEL,
  TERMS_OPTIONS,
  DRAFT_INVOICE_NUMBER_LABEL,
  type InvoiceLineDraft,
} from "@/modules/billing/invoiceLineUtils";
import type {
  Company,
  Contact,
  OrganizationMember,
} from "@/components/atomic-crm/types";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  invoiceDocumentArticleClass,
  invoiceDocumentInnerClass,
  invoiceDocumentOuterClass,
} from "@/modules/billing/invoiceDocumentLayout";

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);

const inlineFieldClass =
  "h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0";

const inlineTableInputClass =
  "h-8 w-full min-w-0 border-0 bg-white/80 px-1 shadow-none focus-visible:ring-1 focus-visible:ring-slate-300 rounded-sm tabular-nums text-center";

const invoiceLineNumericCellClass = "px-1 py-2 align-middle text-center";

const metadataRowClass = "flex items-center gap-3 py-0 leading-none";
const metadataLabelClass = "w-[6.75rem] shrink-0 text-slate-500";
const metadataFieldClass = "h-6 w-auto font-medium leading-none";
const metadataSelectTriggerClass =
  "h-6 w-full max-w-[220px] border-0 bg-transparent px-0 py-0 text-sm leading-none shadow-none focus:ring-0";
const totalsValueClass =
  "flex min-h-8 items-center justify-end tabular-nums text-slate-900";
const totalsLabelClass = "flex min-h-8 items-center text-slate-600";

export type InlineInvoiceEditorProps = {
  organizationName: string;
  organizationWebsite?: string | null;
  organizationAddress?: string | null;
  billTo: BillToSelection | null;
  onBillToChange: (value: BillToSelection | null) => void;
  issueDate: string;
  onIssueDateChange: (value: string) => void;
  terms: string;
  onTermsChange: (value: string) => void;
  dueDate: string;
  onDueDateChange: (value: string) => void;
  salesPersonId: number | null;
  onSalesPersonChange: (value: number | null) => void;
  discountPercent: number;
  onDiscountPercentChange: (value: number) => void;
  lines: InvoiceLineDraft[];
  onLinesChange: (lines: InvoiceLineDraft[]) => void;
  saveCard: boolean;
  onSaveCardChange: (value: boolean) => void;
  paymentMode: InvoicePaymentCollectionMode;
  onPaymentModeChange: (value: InvoicePaymentCollectionMode) => void;
  depositPercent: number;
  onDepositPercentChange: (value: number) => void;
  remainderSchedule: InvoiceRemainderScheduleConfig;
  onRemainderScheduleChange: (value: InvoiceRemainderScheduleConfig) => void;
  termsAndConditions: string;
  onTermsAndConditionsChange: (value: string) => void;
  company?: Company | null;
  contact?: Contact | null;
  /** When set, shows the assigned invoice number instead of"Draft". */
  invoiceNumber?: string | null;
  /** Payments already collected against this invoice. */
  amountPaid?: number;
  /** When set, subscription invoices use stored totals instead of transfer-fee gross-up. */
  invoice?: InvoiceDisplaySource | null;
  /** Ribbon text on the document corner (defaults to"Draft" on create). */
  documentRibbon?: string | null;
  paymentMethodBrand?: string | null;
  paymentMethodLast4?: string | null;
  autoChargeRemainder?: boolean;
};

export const InlineInvoiceEditor = ({
  organizationName,
  organizationWebsite,
  organizationAddress,
  billTo,
  onBillToChange,
  issueDate,
  onIssueDateChange,
  terms,
  onTermsChange,
  dueDate,
  onDueDateChange,
  salesPersonId,
  onSalesPersonChange,
  discountPercent,
  onDiscountPercentChange,
  lines,
  onLinesChange,
  saveCard,
  onSaveCardChange,
  paymentMode,
  onPaymentModeChange,
  depositPercent,
  onDepositPercentChange,
  remainderSchedule,
  onRemainderScheduleChange,
  termsAndConditions,
  onTermsAndConditionsChange,
  company,
  contact,
  invoiceNumber,
  amountPaid = 0,
  invoice,
  documentRibbon = DRAFT_INVOICE_NUMBER_LABEL,
  paymentMethodBrand,
  paymentMethodLast4,
  autoChargeRemainder = false,
}: InlineInvoiceEditorProps) => {
  const { subtotal, feeAmount, total } = resolveInvoiceDisplayTotals(
    invoice,
    lines,
    discountPercent,
  );
  const balanceDue = resolveInvoiceBalanceDue(
    invoice ? { ...invoice, amount_paid: amountPaid } : null,
    { total },
  );
  const paymentSummary = describeInvoiceOnlinePaymentSummary({
    paymentMode,
    depositPercent,
    total,
    remainderSchedule,
  });
  const cardOnFile = formatInvoicePaymentMethod({
    payment_method_brand: paymentMethodBrand,
    payment_method_last4: paymentMethodLast4,
  });
  const billToDisplay = resolveBillToDisplay(
    billTo?.company ?? company,
    billTo?.contact ?? contact,
  );
  const billToNameLine = formatBillToNameLine(
    billTo?.company ?? company,
    billTo?.contact ?? contact,
  );

  const { data: salesPeople = [] } = useGetList<OrganizationMember>(
    "organization_members",
    {
      filter: { "disabled@neq": true },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "last_name", order: "ASC" },
    },
    { staleTime: 60_000 },
  );

  const addBlankLine = () => {
    onLinesChange([
      ...lines,
      {
        key: newInvoiceLineKey(),
        title: "",
        item_detail: "",
        quantity: 1,
        unit: "ea",
        unit_price: 0,
        sort_order: lines.length,
      },
    ]);
  };

  const updateLine = (key: string, patch: Partial<InvoiceLineDraft>) => {
    onLinesChange(
      lines.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  };

  const removeLine = (key: string) => {
    if (lines.length <= 1) return;
    onLinesChange(lines.filter((line) => line.key !== key));
  };

  return (
    <div className={invoiceDocumentOuterClass}>
      <article className={invoiceDocumentArticleClass}>
        <div className="pointer-events-none absolute -left-10 top-5 z-10 w-36 -rotate-45 bg-slate-500 py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-white">
          {documentRibbon ?? "Draft"}
        </div>

        <div className={invoiceDocumentInnerClass}>
          <div className="flex flex-wrap items-start justify-between gap-8">
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900">
                INVOICE
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Invoice# {invoiceNumber ?? DRAFT_INVOICE_NUMBER_LABEL}
              </p>
              <div className="mt-8">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Balance Due
                </p>
                <p className="text-4xl font-bold tabular-nums text-slate-900">
                  {formatMoney(balanceDue)}
                </p>
                {amountPaid > 0.01 ? (
                  <p className="mt-1 text-xs text-slate-500">
                    {formatMoney(amountPaid)} paid · {formatMoney(total)} total
                  </p>
                ) : null}
              </div>
            </div>
            <div className="min-w-[200px] text-right text-sm">
              <p className="text-base font-semibold text-slate-900">
                {organizationName}
              </p>
              {organizationAddress ? (
                <p className="mt-1 whitespace-pre-line text-slate-600">
                  {organizationAddress}
                </p>
              ) : null}
              {organizationWebsite ? (
                <p className="mt-1 text-blue-600">{organizationWebsite}</p>
              ) : null}
            </div>
          </div>

          <div className="mt-10 grid gap-8 md:grid-cols-2">
            <div className="space-y-0.5 text-sm leading-none">
              <div className={metadataRowClass}>
                <p className={metadataLabelClass}>Invoice Date</p>
                <Input
                  type="date"
                  value={issueDate}
                  onChange={(event) => onIssueDateChange(event.target.value)}
                  className={cn(inlineFieldClass, metadataFieldClass)}
                />
              </div>
              <div className={metadataRowClass}>
                <p className={metadataLabelClass}>Terms</p>
                <Select value={terms} onValueChange={onTermsChange}>
                  <SelectTrigger className={metadataSelectTriggerClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TERMS_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className={metadataRowClass}>
                <p className={metadataLabelClass}>Due Date</p>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(event) => onDueDateChange(event.target.value)}
                  className={cn(inlineFieldClass, metadataFieldClass)}
                />
              </div>
              <div className={metadataRowClass}>
                <p className={metadataLabelClass}>Currency</p>
                <p className="font-medium text-slate-700">USD</p>
              </div>
              <div className={metadataRowClass}>
                <p className={metadataLabelClass}>Sales person</p>
                <Select
                  value={salesPersonId ? String(salesPersonId) : ""}
                  onValueChange={(value) =>
                    onSalesPersonChange(value ? Number(value) : null)
                  }
                >
                  <SelectTrigger className={metadataSelectTriggerClass}>
                    <SelectValue placeholder="Select team member" />
                  </SelectTrigger>
                  <SelectContent>
                    {salesPeople.map((member) => (
                      <SelectItem key={member.id} value={String(member.id)}>
                        {formatOrganizationMemberName(member) ??
                          `Member #${member.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="text-sm">
              <p className="mb-2 font-semibold text-slate-900">Bill To</p>
              <BillToClientSearch
                value={billTo}
                onChange={onBillToChange}
                variant="inline"
                formattedLabel={billToNameLine}
              />
              {billTo ? (
                <div className="mt-1 space-y-1">
                  {billToDisplay.addressLines.map((line) => (
                    <p key={line} className="text-slate-600">
                      {line}
                    </p>
                  ))}
                  {billToDisplay.email ? (
                    <p className="text-slate-600">{billToDisplay.email}</p>
                  ) : null}
                  {billToDisplay.phone ? (
                    <p className="text-slate-600">{billToDisplay.phone}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-10 overflow-visible rounded-md border border-slate-200">
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col />
                <col style={{ width: "3.75rem" }} />
                <col style={{ width: "5.25rem" }} />
                <col style={{ width: "5.5rem" }} />
                <col style={{ width: "2.25rem" }} />
              </colgroup>
              <thead>
                <tr className="bg-slate-700 text-left text-[11px] uppercase tracking-wide text-white">
                  <th className="px-3 py-2.5 font-medium">
                    Item & Description
                  </th>
                  <th className="px-1 py-2.5 font-medium text-center">Qty</th>
                  <th className="px-1 py-2.5 font-medium text-center">Rate</th>
                  <th className="px-1 py-2.5 font-medium text-center">
                    Amount
                  </th>
                  <th className="w-9" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.key} className="border-t border-slate-100">
                    <td className="px-2 py-2 align-top">
                      <CatalogLineItemField
                        line={line}
                        onChange={(patch) => updateLine(line.key, patch)}
                      />
                    </td>
                    <td className={invoiceLineNumericCellClass}>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.quantity}
                        onChange={(event) =>
                          updateLine(line.key, {
                            quantity: Number(event.target.value) || 0,
                          })
                        }
                        className={inlineTableInputClass}
                      />
                    </td>
                    <td className={invoiceLineNumericCellClass}>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unit_price}
                        onChange={(event) =>
                          updateLine(line.key, {
                            unit_price: Number(event.target.value) || 0,
                          })
                        }
                        className={inlineTableInputClass}
                      />
                    </td>
                    <td
                      className={cn(
                        invoiceLineNumericCellClass,
                        "text-sm font-medium tabular-nums",
                      )}
                    >
                      {invoiceLineTotal(line.quantity, line.unit_price).toFixed(
                        2,
                      )}
                    </td>
                    <td className="px-0 py-2 align-middle">
                      <IconButton
                        aria-label="Delete"
                        className="size-7 text-slate-400 hover:text-red-600"
                        disabled={lines.length <= 1}
                        onClick={() => removeLine(line.key)}
                      >
                        <Trash2 className="size-3.5" />
                      </IconButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t bg-slate-50 px-3 py-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-slate-600"
                onClick={addBlankLine}
              >
                <Plus className="size-3.5" />
                Add line
              </Button>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <div className="w-full max-w-[18rem] text-sm">
              <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-x-4">
                <span className={totalsLabelClass}>Sub Total</span>
                <span className={totalsValueClass}>
                  {formatMoney(subtotal)}
                </span>

                <span className={totalsLabelClass}>Discount</span>
                <div className={totalsValueClass}>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={discountPercent || ""}
                    onChange={(event) =>
                      onDiscountPercentChange(Number(event.target.value) || 0)
                    }
                    placeholder="0"
                    className="h-8 w-[3.25rem] border-0 bg-transparent p-0 text-right tabular-nums shadow-none focus-visible:ring-1 focus-visible:ring-slate-300"
                  />
                  <span className="shrink-0 text-slate-500">%</span>
                </div>

                <span className={totalsLabelClass}>
                  Transfer Fee{" "}
                  <span className="text-[11px] font-normal text-slate-400">
                    ({STRIPE_TRANSFER_FEE_LABEL})
                  </span>
                </span>
                <span className={totalsValueClass}>
                  {formatMoney(feeAmount)}
                </span>

                <div className="col-span-2 my-1 border-t border-slate-200" />

                <span
                  className={cn(
                    totalsLabelClass,
                    "font-semibold text-slate-900",
                  )}
                >
                  Total
                </span>
                <span className={cn(totalsValueClass, "font-semibold")}>
                  {formatMoney(total)}
                </span>

                {amountPaid > 0.01 ? (
                  <>
                    <span className={totalsLabelClass}>Amount Paid</span>
                    <span className={cn(totalsValueClass, "text-emerald-700")}>
                      -{formatMoney(amountPaid)}
                    </span>
                  </>
                ) : null}

                <span
                  className={cn(
                    totalsLabelClass,
                    "font-semibold text-slate-900",
                  )}
                >
                  Balance Due
                </span>
                <span className={cn(totalsValueClass, "font-semibold")}>
                  {formatMoney(balanceDue)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-8 border-t pt-6">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Terms & Conditions
            </p>
            <Textarea
              value={termsAndConditions}
              onChange={(event) =>
                onTermsAndConditionsChange(event.target.value)
              }
              rows={5}
              placeholder="Payment terms, scope notes, or legal copy shown at the bottom of the invoice…"
              className="mt-2 resize-y border-slate-200 bg-slate-50/50 text-sm leading-relaxed text-slate-700 shadow-none focus-visible:ring-slate-300"
            />
          </div>

          <div className="mt-8 border-t pt-6">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Online payment
            </p>
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
              <p className="text-sm text-slate-700">{paymentSummary}</p>
              {cardOnFile ? (
                <p className="mt-2 text-sm text-slate-700">
                  Card on file · {cardOnFile}
                </p>
              ) : null}
              {autoChargeRemainder && cardOnFile ? (
                <p className="mt-2 text-sm font-medium text-emerald-800">
                  Auto-pay active — remaining installments charge automatically.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </article>
    </div>
  );
};
