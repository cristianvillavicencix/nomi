import { useMutation } from "@tanstack/react-query";
import {
  CreditCard,
  FileText,
  Loader2,
  Lock,
  Package,
  PanelLeftOpen,
  PanelRightClose,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  useCreate,
  useDataProvider,
  useDelete,
  useGetList,
  useGetOne,
  useNotify,
  useRefresh,
  useUpdate,
} from "ra-core";
import { Link } from "react-router";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type {
  ClientInvoice,
  Ticket,
  TicketDeliverable,
  TicketInternalFile,
} from "@/modules/types";
import {
  calculateSupplementPricing,
  formatSupplementMoney,
  supplementPricingFromTicket,
} from "@/modules/tickets/supplementPricing";
import {
  MAX_TICKET_ATTACHMENTS,
  MAX_TICKET_ATTACHMENT_BYTES,
  uploadTicketAttachment,
} from "@/modules/tickets/uploadTicketAttachment";
import { resolveTicketRequesterEmail } from "@/modules/tickets/ticketRequester";
import type { Company, Contact } from "@/components/atomic-crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "tickets-billing-side-collapsed";

const SideSection = ({
  icon: Icon,
  title,
  hint,
  hintClassName,
  children,
  className,
}: {
  icon: typeof CreditCard;
  title: string;
  hint?: ReactNode;
  hintClassName?: string;
  children: ReactNode;
  className?: string;
}) => (
  <section className={cn("space-y-3 rounded-lg border bg-background p-3", className)}>
    <div className="flex items-center gap-2">
      <Icon className="size-4 text-muted-foreground" />
      <h3 className="text-sm font-medium">{title}</h3>
      {hint ? (
        <span className={cn("text-xs text-muted-foreground", hintClassName)}>
          {hint}
        </span>
      ) : null}
    </div>
    {children}
  </section>
);

const FileRow = ({
  name,
  meta,
  onRemove,
  canRemove,
  accent,
}: {
  name: string;
  meta?: string;
  onRemove?: () => void;
  canRemove?: boolean;
  accent?: "default" | "delivery";
}) => (
  <div
    className={cn(
      "flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-sm",
      accent === "delivery" && "border-sky-200/80 bg-sky-50/50 dark:border-sky-900/50 dark:bg-sky-950/20",
    )}
  >
    <span className="inline-flex min-w-0 items-center gap-2">
      <FileText className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 truncate">{name}</span>
      {meta ? (
        <span className="shrink-0 text-xs text-muted-foreground">{meta}</span>
      ) : null}
    </span>
    {canRemove && onRemove ? (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 shrink-0"
        onClick={onRemove}
      >
        <Trash2 className="size-3.5" />
      </Button>
    ) : null}
  </div>
);

const DashedAddButton = ({
  label,
  loading,
  onClick,
}: {
  label: string;
  loading?: boolean;
  onClick: () => void;
}) => (
  <Button
    type="button"
    variant="outline"
    size="sm"
    className="h-9 w-full border-dashed"
    disabled={loading}
    onClick={onClick}
  >
    {loading ? (
      <Loader2 className="mr-1.5 size-3.5 animate-spin" />
    ) : (
      <Plus className="mr-1.5 size-3.5" />
    )}
    {label}
  </Button>
);

type TicketBillingSidePanelProps = {
  ticket: Ticket;
  company?: Company | null;
  contact?: Contact | null;
};

export const TicketBillingSidePanel = ({
  ticket,
  company,
  contact,
}: TicketBillingSidePanelProps) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const deliverableInputRef = useRef<HTMLInputElement | null>(null);
  const internalInputRef = useRef<HTMLInputElement | null>(null);
  const [update] = useUpdate();
  const [createDeliverable] = useCreate();
  const [createInternalFile] = useCreate();
  const [deleteDeliverable] = useDelete();
  const [deleteInternalFile] = useDelete();

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof sessionStorage === "undefined") return false;
    return sessionStorage.getItem(STORAGE_KEY) === "true";
  });

  const [itemCount, setItemCount] = useState(String(ticket.billing_item_count ?? 0));
  const [hasRoof, setHasRoof] = useState(Boolean(ticket.billing_has_roof));
  const [hasSiding, setHasSiding] = useState(Boolean(ticket.billing_has_siding));
  const [hasEsx, setHasEsx] = useState(Boolean(ticket.billing_has_esx));
  const [hasPdfAnalysis, setHasPdfAnalysis] = useState(
    Boolean(ticket.billing_has_pdf_analysis),
  );
  const [uploadingDeliverables, setUploadingDeliverables] = useState(false);
  const [uploadingInternal, setUploadingInternal] = useState(false);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  const { data: deliverables = [] } = useGetList<TicketDeliverable>(
    "ticket_deliverables",
    {
      filter: { "ticket_id@eq": ticket.id },
      sort: { field: "sort_order", order: "ASC" },
      pagination: { page: 1, perPage: 20 },
    },
    { enabled: Boolean(ticket.id) },
  );

  const { data: internalFiles = [] } = useGetList<TicketInternalFile>(
    "ticket_internal_files",
    {
      filter: { "ticket_id@eq": ticket.id },
      sort: { field: "sort_order", order: "ASC" },
      pagination: { page: 1, perPage: 20 },
    },
    { enabled: Boolean(ticket.id) },
  );

  const { data: invoice } = useGetOne<ClientInvoice>(
    "client_invoices",
    { id: ticket.invoice_id ?? "" },
    { enabled: Boolean(ticket.invoice_id) },
  );

  const pricing = useMemo(
    () =>
      calculateSupplementPricing({
        itemCount: Number(itemCount) || 0,
        hasRoof,
        hasSiding,
        hasEsx,
        hasPdfAnalysis,
      }),
    [itemCount, hasRoof, hasSiding, hasEsx, hasPdfAnalysis],
  );

  const baselinePricing = useMemo(
    () => supplementPricingFromTicket(ticket),
    [ticket],
  );

  const billingDirty =
    Number(itemCount) !== (ticket.billing_item_count ?? 0) ||
    hasRoof !== Boolean(ticket.billing_has_roof) ||
    hasSiding !== Boolean(ticket.billing_has_siding) ||
    hasEsx !== Boolean(ticket.billing_has_esx) ||
    hasPdfAnalysis !== Boolean(ticket.billing_has_pdf_analysis);

  const displayPricing = billingDirty ? pricing : baselinePricing;
  const displayTotal = invoice
    ? Number(invoice.amount) || displayPricing.total
    : displayPricing.total;

  const paymentBadge = invoice
    ? invoice.status === "paid"
      ? { label: "Paid", className: "border-emerald-200 text-emerald-700" }
      : { label: "Unpaid", className: "border-amber-200 text-amber-700" }
    : { label: "Draft", className: "border-border text-muted-foreground" };

  const saveBillingMutation = useMutation({
    mutationFn: async () => {
      await update(
        "tickets",
        {
          id: ticket.id,
          data: {
            billing_item_count: Math.max(0, Math.floor(Number(itemCount) || 0)),
            billing_has_roof: hasRoof,
            billing_has_siding: hasSiding,
            billing_has_esx: hasEsx,
            billing_has_pdf_analysis: hasPdfAnalysis,
            ...(deliverables.length > 0 && ticket.delivery_status === "none"
              ? { delivery_status: "ready" }
              : {}),
          },
          previousData: ticket,
        },
        { mutationMode: "optimistic" },
      );
    },
    onSuccess: () => refresh(),
    onError: () => notify("Could not save pricing", { type: "error" }),
  });

  const invoiceMutation = useMutation({
    mutationFn: async () => {
      if (billingDirty) await saveBillingMutation.mutateAsync();
      return dataProvider.createTicketInvoice({
        ticketId: ticket.id,
        baseUrl: window.location.origin,
      });
    },
    onSuccess: () => {
      notify("Invoice sent — files will deliver after payment", {
        type: "success",
      });
      refresh();
    },
    onError: (error: Error) =>
      notify(error.message || "Could not send invoice", { type: "error" }),
  });

  const remindMutation = useMutation({
    mutationFn: async () => {
      if (!invoice?.id) throw new Error("No invoice on this ticket");
      const to = resolveTicketRequesterEmail(ticket, company, contact);
      if (!to) throw new Error("No recipient email on file");
      return dataProvider.sendClientInvoicePaymentLink({
        invoiceId: invoice.id,
        to,
      });
    },
    onSuccess: () => notify("Payment reminder sent", { type: "success" }),
    onError: (error: Error) =>
      notify(error.message || "Could not send reminder", { type: "error" }),
  });

  const deliverMutation = useMutation({
    mutationFn: () => dataProvider.deliverTicket({ ticketId: ticket.id }),
    onSuccess: () => {
      notify("Files delivered to client", { type: "success" });
      refresh();
    },
    onError: (error: Error) =>
      notify(error.message || "Could not deliver files", { type: "error" }),
  });

  const uploadFiles = async (
    files: FileList | null,
    kind: "deliverable" | "internal",
  ) => {
    if (!files?.length) return;
    const existing =
      kind === "deliverable" ? deliverables.length : internalFiles.length;
    if (existing + files.length > MAX_TICKET_ATTACHMENTS) {
      notify(`Maximum ${MAX_TICKET_ATTACHMENTS} files`, { type: "warning" });
      return;
    }

    const setLoading =
      kind === "deliverable" ? setUploadingDeliverables : setUploadingInternal;
    const resource =
      kind === "deliverable" ? "ticket_deliverables" : "ticket_internal_files";
    const create = kind === "deliverable" ? createDeliverable : createInternalFile;

    setLoading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_TICKET_ATTACHMENT_BYTES) {
          throw new Error(`"${file.name}" exceeds the 10 MB limit`);
        }
        const uploaded = await uploadTicketAttachment(file);
        await create(
          resource,
          {
            data: {
              ticket_id: ticket.id,
              title: uploaded.title,
              type: uploaded.type,
              path: uploaded.path,
              src: uploaded.src,
              sort_order: existing,
            },
          },
          { returnPromise: true },
        );
      }

      if (kind === "deliverable" && ticket.delivery_status === "none") {
        await update(
          "tickets",
          {
            id: ticket.id,
            data: { delivery_status: "ready" },
            previousData: ticket,
          },
          { mutationMode: "optimistic" },
        );
      }

      notify(kind === "deliverable" ? "Deliverable added" : "Internal file added", {
        type: "info",
      });
      refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Upload failed", {
        type: "error",
      });
    } finally {
      setLoading(false);
      if (kind === "deliverable" && deliverableInputRef.current) {
        deliverableInputRef.current.value = "";
      }
      if (kind === "internal" && internalInputRef.current) {
        internalInputRef.current.value = "";
      }
    }
  };

  const canSendInvoice =
    !ticket.invoice_id &&
    deliverables.length > 0 &&
    ticket.delivery_status !== "delivered";

  const canManualDeliver =
    Boolean(invoice?.status === "paid") &&
    ticket.delivery_status !== "delivered" &&
    deliverables.length > 0;

  if (collapsed) {
    return (
      <aside className="flex w-11 shrink-0 flex-col items-center gap-3 self-stretch border-l bg-background py-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Show billing panel"
              onClick={() => setCollapsed(false)}
            >
              <PanelLeftOpen className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Show billing & delivery</TooltipContent>
        </Tooltip>

        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col items-center gap-0.5">
                <CreditCard className="size-4" />
                <span className="text-[10px] font-medium tabular-nums">
                  {Math.round(displayTotal)}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="left">Payment</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col items-center gap-0.5">
                <Lock className="size-4" />
                {internalFiles.length > 0 ? (
                  <span className="text-[10px] font-medium tabular-nums">
                    {internalFiles.length}
                  </span>
                ) : null}
              </div>
            </TooltipTrigger>
            <TooltipContent side="left">
              Internal files ({internalFiles.length})
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col items-center gap-0.5">
                <Package className="size-4" />
                {deliverables.length > 0 ? (
                  <span className="text-[10px] font-medium tabular-nums">
                    {deliverables.length}
                  </span>
                ) : null}
              </div>
            </TooltipTrigger>
            <TooltipContent side="left">
              Delivery package ({deliverables.length})
            </TooltipContent>
          </Tooltip>
        </div>

        <span className="mt-auto rotate-180 text-[10px] uppercase tracking-wide text-muted-foreground [writing-mode:vertical-rl]">
          Billing
        </span>
      </aside>
    );
  }

  return (
    <aside className="flex w-[min(50%,22rem)] shrink-0 flex-col self-stretch border-l bg-muted/15">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <p className="text-xs font-medium text-muted-foreground">
          Billing & delivery
        </p>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Hide billing panel"
              onClick={() => setCollapsed(true)}
            >
              <PanelRightClose className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Hide panel</TooltipContent>
        </Tooltip>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <SideSection icon={CreditCard} title="Payment">
          <div className="flex items-start justify-between gap-2">
            <p className="text-3xl font-semibold tabular-nums tracking-tight">
              {formatSupplementMoney(displayTotal)}
            </p>
            <Badge variant="outline" className={paymentBadge.className}>
              {paymentBadge.label}
            </Badge>
          </div>

          {invoice ? (
            <p className="text-xs text-muted-foreground">
              {invoice.invoice_number} · {invoice.status ?? "draft"} · 100%
              upfront
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Configure pricing below, then send the invoice.
            </p>
          )}

          {!ticket.invoice_id ? (
            <div className="space-y-3 border-t pt-3">
              <div className="grid gap-2">
                <Label htmlFor={`side-items-${ticket.id}`}>Line item count</Label>
                <Input
                  id={`side-items-${ticket.id}`}
                  type="number"
                  min={0}
                  value={itemCount}
                  onChange={(event) => setItemCount(event.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                {[
                  { label: "Roof (+$25)", checked: hasRoof, set: setHasRoof },
                  {
                    label: "Siding (+$50)",
                    checked: hasSiding,
                    set: setHasSiding,
                  },
                  { label: "ESX (+$40)", checked: hasEsx, set: setHasEsx },
                  {
                    label: "PDF (+$10)",
                    checked: hasPdfAnalysis,
                    set: setHasPdfAnalysis,
                  },
                ].map((option) => (
                  <label
                    key={option.label}
                    className="flex items-center gap-2 text-xs"
                  >
                    <Checkbox
                      checked={option.checked}
                      onCheckedChange={(value) => option.set(value === true)}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
              <div className="space-y-1 rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground">
                {displayPricing.lines.map((line) => (
                  <div key={line.description} className="flex justify-between gap-2">
                    <span className="truncate">{line.description}</span>
                    <span className="tabular-nums">
                      {formatSupplementMoney(line.lineTotal)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between gap-2 border-t pt-1 font-medium text-foreground">
                  <span>Total</span>
                  <span className="tabular-nums">
                    {formatSupplementMoney(displayPricing.total)}
                  </span>
                </div>
              </div>
              {billingDirty ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={saveBillingMutation.isPending}
                  onClick={() => saveBillingMutation.mutate()}
                >
                  Save pricing
                </Button>
              ) : null}
            </div>
          ) : null}

          <div className="flex gap-2">
            {invoice ? (
              <Button type="button" variant="outline" size="sm" className="flex-1" asChild>
                <Link to={`/invoices/${invoice.id}/show`}>View invoice</Link>
              </Button>
            ) : null}
            {invoice && invoice.status !== "paid" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={remindMutation.isPending}
                onClick={() => remindMutation.mutate()}
              >
                Remind
              </Button>
            ) : null}
            {canSendInvoice ? (
              <Button
                type="button"
                size="sm"
                className="w-full"
                disabled={invoiceMutation.isPending}
                onClick={() => invoiceMutation.mutate()}
              >
                {invoiceMutation.isPending ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : null}
                Send invoice
              </Button>
            ) : null}
          </div>
        </SideSection>

        <SideSection icon={Lock} title="Internal files" hint="team only">
          <div className="space-y-2">
            {internalFiles.map((file) => (
              <FileRow
                key={file.id}
                name={file.title}
                canRemove
                onRemove={() =>
                  void deleteInternalFile(
                    "ticket_internal_files",
                    { id: file.id, previousData: file },
                    { mutationMode: "optimistic" },
                  ).then(refresh)
                }
              />
            ))}
          </div>
          <input
            ref={internalInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => void uploadFiles(event.target.files, "internal")}
          />
          <DashedAddButton
            label="Add internal file"
            loading={uploadingInternal}
            onClick={() => internalInputRef.current?.click()}
          />
        </SideSection>

        <SideSection
          icon={Package}
          title="Delivery package"
          hint="sent on payment"
          hintClassName="text-primary"
        >
          <div className="space-y-2">
            {deliverables.map((file) => (
              <FileRow
                key={file.id}
                name={file.title}
                accent="delivery"
                canRemove={!ticket.invoice_id}
                onRemove={() =>
                  void deleteDeliverable(
                    "ticket_deliverables",
                    { id: file.id, previousData: file },
                    { mutationMode: "optimistic" },
                  ).then(refresh)
                }
              />
            ))}
          </div>
          {!ticket.invoice_id ? (
            <>
              <input
                ref={deliverableInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) =>
                  void uploadFiles(event.target.files, "deliverable")
                }
              />
              <DashedAddButton
                label="Add deliverable"
                loading={uploadingDeliverables}
                onClick={() => deliverableInputRef.current?.click()}
              />
            </>
          ) : null}

          {canManualDeliver ? (
            <Button
              type="button"
              className="w-full"
              disabled={deliverMutation.isPending}
              onClick={() => deliverMutation.mutate()}
            >
              {deliverMutation.isPending ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <Send className="mr-1.5 size-4" />
              )}
              Deliver now (manual)
            </Button>
          ) : null}

          {ticket.delivery_status === "delivered" && ticket.delivered_at ? (
            <p className="text-center text-xs text-muted-foreground">
              Delivered {new Date(ticket.delivered_at).toLocaleString()}
            </p>
          ) : null}
        </SideSection>
      </div>
    </aside>
  );
};

/** @deprecated Use TicketBillingSidePanel in the detail layout */
export const TicketBillingPanel = TicketBillingSidePanel;
