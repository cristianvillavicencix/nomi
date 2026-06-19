import { useMutation } from "@tanstack/react-query";
import {
  Pencil,
  CreditCard,
  FileText,
  Loader2,
  MessageSquare,
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
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type {
  ClientInvoice,
  Ticket,
  TicketDeliverable,
} from "@/modules/types";
import {
  allDeliverablesHaveBilling,
  calculateTicketPricing,
  deliverableBillingSummary,
  formatSupplementMoney,
} from "@/modules/tickets/supplementPricing";
import {
  TicketDeliverableBillingDialog,
  type DeliverableBillingSelection,
} from "@/modules/tickets/TicketDeliverableBillingDialog";
import { resolveTicketRequesterEmail } from "@/modules/tickets/ticketRequester";
import {
  MAX_TICKET_ATTACHMENTS,
  MAX_TICKET_ATTACHMENT_BYTES,
  uploadTicketAttachment,
} from "@/modules/tickets/uploadTicketAttachment";
import { TicketToolsClientSms } from "@/modules/tickets/TicketToolsClientSms";
import { TicketToolsInvoiceSection } from "@/modules/tickets/TicketToolsInvoiceSection";
import { TicketInvoicePreviewDialog } from "@/modules/tickets/TicketInvoicePreviewDialog";
import { TicketInvoiceReminderDialog } from "@/modules/tickets/TicketInvoiceReminderDialog";
import {
  TicketInvoiceViewDialog,
  type TicketInvoiceViewMode,
} from "@/modules/tickets/TicketInvoiceViewDialog";
import type { Company, Contact } from "@/components/atomic-crm/types";
import { canEditClientInvoice } from "@/modules/billing/billingUtils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "tickets-tools-side-collapsed";

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
  <section className={cn("space-y-3 px-4 py-4", className)}>
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
  onEdit,
  canRemove,
  canEdit,
}: {
  name: string;
  meta?: string;
  onRemove?: () => void;
  onEdit?: () => void;
  canRemove?: boolean;
  canEdit?: boolean;
}) => (
  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 py-2.5">
    <div className="min-w-0">
      <div className="flex min-w-0 items-start gap-2">
        <FileText className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        <p className="min-w-0 truncate text-sm leading-snug" title={name}>
          {name}
        </p>
      </div>
      {meta ? (
        <p
          className="mt-1 truncate pl-5 text-xs leading-snug text-muted-foreground"
          title={meta}
        >
          {meta}
        </p>
      ) : null}
    </div>
    <div className="flex shrink-0 items-start gap-0.5">
      {canEdit && onEdit ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onEdit}
        >
          <Pencil className="size-3.5" />
        </Button>
      ) : null}
      {canRemove && onRemove ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onRemove}
        >
          <Trash2 className="size-3.5" />
        </Button>
      ) : null}
    </div>
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
  const [update] = useUpdate();
  const [createDeliverable] = useCreate();
  const [deleteDeliverable] = useDelete();

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof sessionStorage === "undefined") return false;
    return sessionStorage.getItem(STORAGE_KEY) === "true";
  });

  const [pendingUploads, setPendingUploads] = useState<File[]>([]);
  const [billingDialogOpen, setBillingDialogOpen] = useState(false);
  const [billingFileName, setBillingFileName] = useState<string | null>(null);
  const [billingInitial, setBillingInitial] =
    useState<DeliverableBillingSelection | null>(null);
  const [editingDeliverable, setEditingDeliverable] =
    useState<TicketDeliverable | null>(null);
  const [uploadingDeliverables, setUploadingDeliverables] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [invoiceDialogMode, setInvoiceDialogMode] =
    useState<TicketInvoiceViewMode>("view");

  const openInvoiceDialog = (mode: TicketInvoiceViewMode) => {
    setInvoiceDialogMode(mode);
    setInvoiceDialogOpen(true);
  };

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

  const { data: invoice } = useGetOne<ClientInvoice>(
    "client_invoices",
    { id: ticket.invoice_id ?? "" },
    { enabled: Boolean(ticket.invoice_id), retry: false },
  );

  const propertyAddress = ticket.subject ?? "Property";

  const pricing = useMemo(
    () => calculateTicketPricing(deliverables, ticket, propertyAddress),
    [deliverables, ticket, propertyAddress],
  );

  const displayTotal = invoice
    ? Number(invoice.amount) || pricing.total
    : pricing.subtotal;

  const deliverablesReadyForInvoice = allDeliverablesHaveBilling(deliverables);

  const paymentBadge = invoice
    ? invoice.status === "paid"
      ? { label: "Paid", className: "border-emerald-200 text-emerald-700" }
      : { label: "Unpaid", className: "border-amber-200 text-amber-700" }
    : { label: "Draft", className: "border-border text-muted-foreground" };

  const openInvoicePreview = async () => {
    if (!deliverables.length) {
      notify("Upload at least one delivery file before sending an invoice", {
        type: "warning",
      });
      return;
    }
    if (!deliverablesReadyForInvoice) {
      notify("Set billing type for each delivery file before sending", {
        type: "warning",
      });
      return;
    }
    if (!ticket.company_id && !ticket.contact_id) {
      notify("Link a company or contact before sending an invoice", {
        type: "warning",
      });
      return;
    }
    const email = resolveTicketRequesterEmail(ticket, company, contact);
    if (!email) {
      notify("Add a valid recipient email before sending an invoice", {
        type: "warning",
      });
      return;
    }
    setPreviewOpen(true);
  };

  const canEditInvoice = invoice ? canEditClientInvoice(invoice) : false;

  const deliverMutation = useMutation({
    mutationFn: () => dataProvider.deliverTicket({ ticketId: ticket.id }),
    onSuccess: () => {
      notify("Files delivered to client", { type: "success" });
      refresh();
    },
    onError: (error: Error) =>
      notify(error.message || "Could not deliver files", { type: "error" }),
  });

  const markDeliveryReady = async () => {
    if (ticket.delivery_status !== "none") return;
    await update(
      "tickets",
      {
        id: ticket.id,
        data: { delivery_status: "ready" },
        previousData: ticket,
      },
      { mutationMode: "optimistic" },
    );
  };

  const openBillingDialogForUpload = (files: File[]) => {
    setEditingDeliverable(null);
    setPendingUploads(files);
    setBillingFileName(files[0]?.name ?? null);
    setBillingInitial(null);
    setBillingDialogOpen(true);
  };

  const openBillingDialogForEdit = (deliverable: TicketDeliverable) => {
    setPendingUploads([]);
    setEditingDeliverable(deliverable);
    setBillingFileName(deliverable.title);
    setBillingInitial(
      deliverable.billing_kind
        ? {
            billing_kind: deliverable.billing_kind,
            billing_line_count: deliverable.billing_line_count ?? null,
          }
        : null,
    );
    setBillingDialogOpen(true);
  };

  const handleBillingDialogOpenChange = (open: boolean) => {
    setBillingDialogOpen(open);
    if (!open) {
      setPendingUploads([]);
      setEditingDeliverable(null);
      setBillingFileName(null);
      setBillingInitial(null);
      if (deliverableInputRef.current) {
        deliverableInputRef.current.value = "";
      }
    }
  };

  const handleBillingConfirm = async (selection: DeliverableBillingSelection) => {
    if (editingDeliverable) {
      try {
        await update(
          "ticket_deliverables",
          {
            id: editingDeliverable.id,
            data: {
              billing_kind: selection.billing_kind,
              billing_line_count: selection.billing_line_count,
            },
            previousData: editingDeliverable,
          },
          { returnPromise: true },
        );
        notify("Billing updated", { type: "info" });
        handleBillingDialogOpenChange(false);
        refresh();
      } catch (error) {
        notify(error instanceof Error ? error.message : "Could not save billing", {
          type: "error",
        });
      }
      return;
    }

    const file = pendingUploads[0];
    if (!file) return;

    setUploadingDeliverables(true);
    try {
      if (file.size > MAX_TICKET_ATTACHMENT_BYTES) {
        throw new Error(`"${file.name}" exceeds the 10 MB limit`);
      }

      const uploaded = await uploadTicketAttachment(file);
      await createDeliverable(
        "ticket_deliverables",
        {
          data: {
            ticket_id: ticket.id,
            title: uploaded.title,
            type: uploaded.type,
            path: uploaded.path,
            src: uploaded.src,
            sort_order: deliverables.length,
            billing_kind: selection.billing_kind,
            billing_line_count: selection.billing_line_count,
          },
        },
        { returnPromise: true },
      );

      await markDeliveryReady();

      const remaining = pendingUploads.slice(1);
      if (remaining.length > 0) {
        setPendingUploads(remaining);
        setBillingFileName(remaining[0].name);
        setBillingInitial(null);
        notify("Deliverable added", { type: "info" });
        refresh();
      } else {
        notify("Deliverable added", { type: "info" });
        handleBillingDialogOpenChange(false);
        refresh();
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "Upload failed", {
        type: "error",
      });
    } finally {
      setUploadingDeliverables(false);
    }
  };

  const queueDeliverableUploads = (files: FileList | null) => {
    if (!files?.length) return;
    const fileArray = Array.from(files);
    if (deliverables.length + fileArray.length > MAX_TICKET_ATTACHMENTS) {
      notify(`Maximum ${MAX_TICKET_ATTACHMENTS} files`, { type: "warning" });
      return;
    }
    for (const file of fileArray) {
      if (file.size > MAX_TICKET_ATTACHMENT_BYTES) {
        notify(`"${file.name}" exceeds the 10 MB limit`, { type: "warning" });
        return;
      }
    }
    openBillingDialogForUpload(fileArray);
  };

  const canSendInvoice =
    !ticket.invoice_id &&
    deliverables.length > 0 &&
    deliverablesReadyForInvoice &&
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
              aria-label="Show tools panel"
              onClick={() => setCollapsed(false)}
            >
              <PanelLeftOpen className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Show tools</TooltipContent>
        </Tooltip>

        <div className="flex flex-col items-center gap-3 text-muted-foreground">
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
                <MessageSquare className="size-4" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="left">Text client</TooltipContent>
          </Tooltip>
        </div>

        <span className="mt-auto rotate-180 text-[10px] uppercase tracking-wide text-muted-foreground [writing-mode:vertical-rl]">
          Tools
        </span>
      </aside>
    );
  }

  return (
    <aside className="flex w-[min(50%,22rem)] shrink-0 flex-col self-stretch border-l bg-background">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <p className="text-xs font-medium text-muted-foreground">Tools</p>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Hide tools panel"
              onClick={() => setCollapsed(true)}
            >
              <PanelRightClose className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Hide panel</TooltipContent>
        </Tooltip>
      </div>

      <div className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
        <SideSection
          icon={Package}
          title="Delivery package"
          hint="sent on payment"
          hintClassName="text-primary"
        >
          {deliverables.length > 0 ? (
            <div className="divide-y divide-border/70">
              {deliverables.map((file) => (
                <FileRow
                  key={file.id}
                  name={file.title}
                  meta={deliverableBillingSummary(file, propertyAddress)}
                  canRemove={!ticket.invoice_id}
                  canEdit={!ticket.invoice_id}
                  onEdit={() => openBillingDialogForEdit(file)}
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
          ) : (
            <p className="text-xs text-muted-foreground">
              Add files to deliver after payment.
            </p>
          )}
          {!ticket.invoice_id ? (
            <>
              <input
                ref={deliverableInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) =>
                  void queueDeliverableUploads(event.target.files)
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
              Invoice sent · 100% upfront
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Add delivery files and set billing on each one, then send the invoice.
            </p>
          )}

          {!ticket.invoice_id ? (
            <div className="space-y-3 border-t border-border/70 pt-3">
              <p className="text-xs text-muted-foreground">
                One invoice line per delivery file.
              </p>
              <div className="space-y-1 text-xs text-muted-foreground">
                {pricing.lines.length > 0 ? (
                  pricing.lines.map((line) => (
                    <div key={line.description} className="flex justify-between gap-3">
                      <span className="min-w-0 truncate">{line.description}</span>
                      <span className="shrink-0 tabular-nums">
                        {formatSupplementMoney(line.lineTotal)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p>Add delivery files to see invoice lines.</p>
                )}
                <div className="flex justify-between gap-3 border-t border-border/70 pt-2 font-medium text-foreground">
                  <span>Subtotal</span>
                  <span className="tabular-nums">
                    {formatSupplementMoney(pricing.subtotal)}
                  </span>
                </div>
                <p className="pt-1 text-[11px] text-muted-foreground">
                  Processing fee is added automatically on the invoice.
                </p>
              </div>
              {!deliverablesReadyForInvoice && deliverables.length > 0 ? (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Set billing on every delivery file before sending.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {invoice && canEditInvoice ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => openInvoiceDialog("edit")}
              >
                Edit invoice
              </Button>
            ) : null}
            {invoice && invoice.status !== "paid" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setReminderOpen(true)}
              >
                Remind
              </Button>
            ) : null}
            {canSendInvoice ? (
              <Button
                type="button"
                size="sm"
                className="w-full"
                onClick={() => void openInvoicePreview()}
              >
                Review & send
              </Button>
            ) : null}
          </div>
        </SideSection>

        {invoice ? (
          <SideSection icon={FileText} title="Invoice">
            <TicketToolsInvoiceSection
              invoice={invoice}
              onView={() => openInvoiceDialog("view")}
            />
          </SideSection>
        ) : null}

        <SideSection icon={MessageSquare} title="Text client">
          <TicketToolsClientSms ticket={ticket} contact={contact} />
        </SideSection>
      </div>

      <TicketDeliverableBillingDialog
        open={billingDialogOpen}
        fileName={billingFileName}
        propertyAddress={propertyAddress}
        initial={billingInitial}
        confirmLabel={editingDeliverable ? "Save billing" : "Add to delivery package"}
        onOpenChange={handleBillingDialogOpenChange}
        onConfirm={(selection) => void handleBillingConfirm(selection)}
      />
      <TicketInvoicePreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        ticket={ticket}
        company={company}
        contact={contact}
      />
      {invoice ? (
        <TicketInvoiceReminderDialog
          open={reminderOpen}
          onOpenChange={setReminderOpen}
          ticket={ticket}
          invoice={invoice}
          company={company}
          contact={contact}
        />
      ) : null}
      {invoice ? (
        <TicketInvoiceViewDialog
          open={invoiceDialogOpen}
          onOpenChange={setInvoiceDialogOpen}
          mode={invoiceDialogMode}
          invoiceId={Number(invoice.id)}
          company={company}
          contact={contact}
        />
      ) : null}
    </aside>
  );
};

/** @deprecated Use TicketBillingSidePanel in the detail layout */
export const TicketBillingPanel = TicketBillingSidePanel;
