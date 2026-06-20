import { useMutation } from "@tanstack/react-query";
import {
  Pencil,
  CloudUpload,
  CreditCard,
  Download,
  FileText,
  Loader2,
  MessageSquare,
  PanelLeftOpen,
  PanelRightClose,
  Plus,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  useCreate,
  useDataProvider,
  useDelete,
  useGetList,
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
  deliverableBillingLineTotal,
  deliverableBillingShortLabel,
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
import { CollapsibleToolsSection } from "@/modules/tickets/CollapsibleToolsSection";
import { TicketToolsClientSms } from "@/modules/tickets/TicketToolsClientSms";
import { TicketInvoicePreviewDialog } from "@/modules/tickets/TicketInvoicePreviewDialog";
import { TicketInvoiceReminderDialog } from "@/modules/tickets/TicketInvoiceReminderDialog";
import {
  TicketInvoiceViewDialog,
  type TicketInvoiceViewMode,
} from "@/modules/tickets/TicketInvoiceViewDialog";
import type { Company, Contact } from "@/components/atomic-crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  canDismissNewInvoiceTab,
  canStartNewTicketInvoiceCycle,
  formatInvoiceTabLabel,
  getLatestSentPaidInvoiceId,
  getDraftTicketInvoiceId,
  getDeliverablesForInvoice,
  getTicketInvoiceHistoryIds,
  invoiceTabKey,
  isValidInvoiceTab,
  readNewInvoiceCycleActive,
  resolveDefaultInvoiceTab,
  shouldShowNewInvoiceTab,
  writeNewInvoiceCycleActive,
  type TicketInvoiceTabKey,
} from "@/modules/tickets/ticketInvoiceTabs";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "tickets-tools-side-collapsed";
const smsExpandedStorageKey = (ticketId: Ticket["id"]) =>
  `ticket-tools-sms-expanded-${ticketId}`;

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
  const [dragActive, setDragActive] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [invoiceDialogMode, setInvoiceDialogMode] =
    useState<TicketInvoiceViewMode>("view");
  const [dialogInvoiceId, setDialogInvoiceId] = useState<number | null>(null);
  const [selectedInvoiceTab, setSelectedInvoiceTab] =
    useState<TicketInvoiceTabKey | "">("");
  const [newCycleActive, setNewCycleActive] = useState(() =>
    readNewInvoiceCycleActive(ticket.id),
  );
  const [invoiceExpanded, setInvoiceExpanded] = useState(true);
  const [smsExpanded, setSmsExpanded] = useState(() => {
    if (typeof sessionStorage === "undefined") return true;
    return sessionStorage.getItem(smsExpandedStorageKey(ticket.id)) !== "false";
  });

  const openInvoiceDialog = (
    mode: TicketInvoiceViewMode,
    invoiceId: number,
  ) => {
    setDialogInvoiceId(invoiceId);
    setInvoiceDialogMode(mode);
    setInvoiceDialogOpen(true);
  };

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    setInvoiceExpanded(true);
    setSmsExpanded(
      sessionStorage.getItem(smsExpandedStorageKey(ticket.id)) !== "false",
    );
  }, [ticket.id]);

  useEffect(() => {
    sessionStorage.setItem(
      smsExpandedStorageKey(ticket.id),
      String(smsExpanded),
    );
  }, [smsExpanded, ticket.id]);

  const { data: deliverables = [] } = useGetList<TicketDeliverable>(
    "ticket_deliverables",
    {
      filter: { "ticket_id@eq": ticket.id },
      sort: { field: "sort_order", order: "ASC" },
      pagination: { page: 1, perPage: 20 },
    },
    { enabled: Boolean(ticket.id) },
  );

  const propertyAddress = ticket.subject ?? "Property";

  const unbilledDeliverables = useMemo(
    () => deliverables.filter((file) => !file.invoiced_invoice_id),
    [deliverables],
  );

  const invoiceHistoryIds = useMemo(
    () => getTicketInvoiceHistoryIds(ticket, deliverables),
    [ticket, deliverables],
  );

  const { data: invoiceHistory = [] } = useGetList<ClientInvoice>(
    "client_invoices",
    {
      filter: { "id@in": `(${invoiceHistoryIds.join(",")})` },
      pagination: { page: 1, perPage: 50 },
      sort: { field: "id", order: "ASC" },
    },
    { enabled: invoiceHistoryIds.length > 0 },
  );

  const invoicesById = useMemo(() => {
    const map = new Map<string, ClientInvoice>();
    for (const row of invoiceHistory) {
      map.set(String(row.id), row);
    }
    return map;
  }, [invoiceHistory]);

  const invoice = ticket.invoice_id
    ? (invoicesById.get(String(ticket.invoice_id)) ?? null)
    : null;

  const canStartNewInvoiceCycle = canStartNewTicketInvoiceCycle(
    ticket,
    invoiceHistoryIds,
    invoicesById,
    newCycleActive,
  );

  const showNewInvoiceTab = shouldShowNewInvoiceTab(
    ticket,
    deliverables,
    invoiceHistoryIds,
    invoicesById,
    newCycleActive,
  );
  const showNewInvoiceButton =
    invoiceHistoryIds.length > 0 && canStartNewInvoiceCycle;

  const canDismissNewTab = canDismissNewInvoiceTab(
    invoiceHistoryIds,
    deliverables,
    ticket,
    invoicesById,
    newCycleActive,
  );

  const clearNewInvoiceCycle = () => {
    writeNewInvoiceCycleActive(ticket.id, false);
    setNewCycleActive(false);
  };

  const selectLatestInvoiceTab = () => {
    const latestSentPaidId = getLatestSentPaidInvoiceId(
      invoiceHistoryIds,
      invoicesById,
    );
    if (latestSentPaidId) {
      setSelectedInvoiceTab(invoiceTabKey(latestSentPaidId));
      return;
    }
    const lastId = invoiceHistoryIds.at(-1);
    setSelectedInvoiceTab(lastId ? invoiceTabKey(lastId) : "new");
  };

  useEffect(() => {
    setNewCycleActive(readNewInvoiceCycleActive(ticket.id));
  }, [ticket.id]);

  useEffect(() => {
    const latestSentPaidId = getLatestSentPaidInvoiceId(
      invoiceHistoryIds,
      invoicesById,
    );
    if (
      newCycleActive &&
      unbilledDeliverables.length === 0 &&
      latestSentPaidId &&
      ticket.invoice_id &&
      String(ticket.invoice_id) === latestSentPaidId
    ) {
      writeNewInvoiceCycleActive(ticket.id, false);
      setNewCycleActive(false);
    }
  }, [
    newCycleActive,
    unbilledDeliverables.length,
    invoiceHistoryIds,
    invoicesById,
    ticket.invoice_id,
    ticket.id,
  ]);

  useEffect(() => {
    setSelectedInvoiceTab((current) => {
      if (
        current &&
        isValidInvoiceTab(current, invoiceHistoryIds, showNewInvoiceTab)
      ) {
        return current;
      }
      return resolveDefaultInvoiceTab(
        ticket,
        invoiceHistoryIds,
        unbilledDeliverables.length,
        invoicesById,
        deliverables,
        newCycleActive,
      );
    });
  }, [
    ticket,
    invoiceHistoryIds,
    showNewInvoiceTab,
    unbilledDeliverables.length,
    invoicesById,
    deliverables,
    newCycleActive,
  ]);

  const activeSmsInvoice = useMemo(() => {
    const latestSentPaidId = getLatestSentPaidInvoiceId(
      invoiceHistoryIds,
      invoicesById,
    );
    if (latestSentPaidId) {
      return invoicesById.get(latestSentPaidId) ?? null;
    }
    if (ticket.invoice_id) {
      return invoicesById.get(String(ticket.invoice_id)) ?? null;
    }
    return null;
  }, [invoiceHistoryIds, invoicesById, ticket.invoice_id]);

  const pricing = useMemo(
    () => calculateTicketPricing(unbilledDeliverables, ticket, propertyAddress),
    [unbilledDeliverables, ticket, propertyAddress],
  );

  const displayTotal = invoice
    ? Number(invoice.amount) || pricing.total
    : pricing.subtotal;

  const deliverablesReadyForInvoice =
    allDeliverablesHaveBilling(unbilledDeliverables);

  const newInvoiceMutation = useMutation({
    mutationFn: () =>
      dataProvider.startNewTicketInvoice({ ticketId: ticket.id }),
    onSuccess: (result) => {
      writeNewInvoiceCycleActive(ticket.id, true);
      setNewCycleActive(true);
      notify(
        result.already_in_new_cycle
          ? "Add delivery files for the new invoice"
          : result.unbilled_deliverable_count > 0
            ? "Ready for a new invoice — review files and send"
            : "New invoice cycle started — add delivery files first",
        { type: "success" },
      );
      setSelectedInvoiceTab("new");
      refresh();
    },
    onError: (error: Error) => {
      if (!readNewInvoiceCycleActive(ticket.id)) {
        clearNewInvoiceCycle();
        selectLatestInvoiceTab();
      }
      notify(error.message || "Could not start a new invoice", {
        type: "error",
      });
    },
  });

  const cancelNewCycleMutation = useMutation({
    mutationFn: async () => {
      const draftId = getDraftTicketInvoiceId(ticket, invoicesById);
      if (draftId) {
        await dataProvider.cancelTicketInvoiceDraft({ ticketId: ticket.id });
      }
    },
    onSuccess: () => {
      clearNewInvoiceCycle();
      selectLatestInvoiceTab();
      notify("New invoice cancelled", { type: "info" });
      refresh();
    },
    onError: (error: Error) =>
      notify(error.message || "Could not cancel new invoice", {
        type: "error",
      }),
  });

  const handleCancelNewCycle = () => {
    if (!canDismissNewTab) return;
    cancelNewCycleMutation.mutate();
  };

  const openInvoicePreview = async () => {
    if (!unbilledDeliverables.length) {
      notify("Upload at least one new delivery file before sending an invoice", {
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

  const invoiceBlocksSend =
    invoice?.status === "sent" || invoice?.status === "paid";

  const canSendInvoice =
    unbilledDeliverables.length > 0 &&
    deliverablesReadyForInvoice &&
    ticket.delivery_status !== "delivered" &&
    !invoiceBlocksSend;

  const canManualDeliver =
    Boolean(invoice?.status === "paid") &&
    ticket.delivery_status !== "delivered" &&
    deliverables.length > 0;

  const allowsDeliverableUpload =
    selectedInvoiceTab === "new" || invoiceHistoryIds.length === 0;

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragActive(false);
    if (!allowsDeliverableUpload) return;
    void queueDeliverableUploads(event.dataTransfer.files);
  };

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault();
    if (allowsDeliverableUpload) {
      setDragActive(true);
    }
  };

  const handleDragLeave = (event: DragEvent) => {
    if (event.currentTarget.contains(event.relatedTarget as Node)) return;
    setDragActive(false);
  };

  const formatShortDate = (value?: string | null) => {
    if (!value) return null;
    return new Date(value).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  const renderDeliverableDropZone = (compact = false) => (
    <div
      role="button"
      tabIndex={0}
      onClick={() => deliverableInputRef.current?.click()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          deliverableInputRef.current?.click();
        }
      }}
      className={cn(
        "cursor-pointer rounded-none border-2 border-dashed text-center transition-colors",
        compact ? "px-4 py-4" : "px-4 py-8",
        dragActive
          ? "border-primary bg-primary/5"
          : "border-border bg-muted/20 hover:bg-muted/30",
      )}
    >
      <CloudUpload
        className={cn(
          "mx-auto text-muted-foreground",
          compact ? "size-6" : "size-8",
        )}
      />
      <p className={cn("text-sm font-medium", compact ? "mt-2" : "mt-3")}>
        {compact ? "Add deliverable" : "Drag files here"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        .esx · PDF · photos · or click to browse
      </p>
    </div>
  );

  const renderEditableDeliverable = (file: TicketDeliverable) => {
    const amount = deliverableBillingLineTotal(file, propertyAddress);
    return (
      <div
        key={file.id}
        className="rounded-none border border-sky-200/80 bg-sky-50/40 px-3 py-2.5 dark:border-sky-900/50 dark:bg-sky-950/20"
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <div className="flex min-w-0 items-start gap-2">
            <FileText className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <p className="min-w-0 truncate text-sm" title={file.title}>
              {file.title}
            </p>
          </div>
          <div className="flex shrink-0 gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => openBillingDialogForEdit(file)}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() =>
                void deleteDeliverable(
                  "ticket_deliverables",
                  { id: file.id, previousData: file },
                  { mutationMode: "optimistic" },
                ).then(refresh)
              }
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/60 pt-2 text-xs">
          <span className="text-muted-foreground">
            {deliverableBillingShortLabel(file)}
          </span>
          {amount != null ? (
            <span className="font-medium tabular-nums">
              {formatSupplementMoney(amount)}
            </span>
          ) : null}
        </div>
      </div>
    );
  };

  const renderDeliverableDownloadRow = (file: TicketDeliverable) => (
    <div
      key={file.id}
      className="flex items-center justify-between gap-2 rounded-none border px-3 py-2.5"
    >
      <span className="min-w-0 truncate text-sm">{file.title}</span>
      {file.src ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          asChild
        >
          <a
            href={file.src}
            target="_blank"
            rel="noopener noreferrer"
            download={file.title}
          >
            <Download className="size-3.5" />
          </a>
        </Button>
      ) : null}
    </div>
  );

  const renderNewInvoiceTabContent = () => (
    <div className="space-y-3">
      {unbilledDeliverables.length > 0 ? (
        <div className="space-y-2">
          {unbilledDeliverables.map((file) => renderEditableDeliverable(file))}
        </div>
      ) : null}
      {renderDeliverableDropZone(unbilledDeliverables.length > 0)}
      {unbilledDeliverables.length > 0 ? (
        <>
          <div className="space-y-1 border-t border-border/70 pt-3 text-xs">
            <div className="flex justify-between gap-2 text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums text-foreground">
                {formatSupplementMoney(pricing.subtotal)}
              </span>
            </div>
            <div className="flex justify-between gap-2 text-muted-foreground">
              <span>Processing fee</span>
              <span className="tabular-nums text-foreground">
                {formatSupplementMoney(pricing.transferFee)}
              </span>
            </div>
            <div className="flex justify-between gap-2 pt-1 text-sm font-medium">
              <span>Total</span>
              <span className="text-base tabular-nums">
                {formatSupplementMoney(pricing.total)}
              </span>
            </div>
          </div>
          {!deliverablesReadyForInvoice ? (
            <p className="text-xs text-warning">
              Set billing on every delivery file before creating the invoice.
            </p>
          ) : null}
          <Button
            type="button"
            className="w-full rounded-none"
            disabled={!canSendInvoice}
            onClick={() => void openInvoicePreview()}
          >
            <Send className="mr-1.5 size-4" />
            Create invoice & request payment
          </Button>
        </>
      ) : null}
      {canManualDeliver ? (
        <Button
          type="button"
          variant="outline"
          className="w-full rounded-none"
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
    </div>
  );

  const handleNewInvoiceClick = () => {
    const draftInvoiceId = getDraftTicketInvoiceId(ticket, invoicesById);
    if (draftInvoiceId) {
      setSelectedInvoiceTab(invoiceTabKey(draftInvoiceId));
      notify("Send or cancel the current draft invoice first", {
        type: "warning",
      });
      return;
    }

    if (canStartNewInvoiceCycle) {
      writeNewInvoiceCycleActive(ticket.id, true);
      setNewCycleActive(true);
      setSelectedInvoiceTab("new");
      newInvoiceMutation.mutate();
      return;
    }

    if (showNewInvoiceTab) {
      setSelectedInvoiceTab("new");
      return;
    }

    notify(
      "Send the current invoice before starting a new billing cycle",
      { type: "warning" },
    );
  };

  const renderInvoiceTabContent = (invoiceId: string) => {
    const tabInvoice = invoicesById.get(invoiceId);
    const isPaid = tabInvoice?.status === "paid";
    const isSent = tabInvoice?.status === "sent";
    const statusDate =
      formatShortDate(tabInvoice?.paid_at) ??
      formatShortDate(tabInvoice?.sent_at);
    const invoiceFiles = getDeliverablesForInvoice(deliverables, invoiceId);
    const amountLabel = formatSupplementMoney(
      Number(tabInvoice?.amount) || pricing.total,
    );
    const statusLine =
      tabInvoice && (isPaid || isSent)
        ? [
            isPaid ? "Paid & delivered" : "Waiting · payment",
            amountLabel,
            statusDate,
          ]
            .filter(Boolean)
            .join(" · ")
        : null;

    return (
      <div className="space-y-3">
        {tabInvoice ? (
          <div className="rounded-none border px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {tabInvoice.invoice_number || `Invoice #${tabInvoice.id}`}
                  </span>
                  {!isPaid && !isSent ? (
                    <Badge variant="outline" className="rounded-none text-[10px]">
                      Draft
                    </Badge>
                  ) : null}
                </div>
                {statusLine ? (
                  <p
                    className={cn(
                      "text-xs",
                      isPaid ? "text-success" : "text-warning",
                    )}
                  >
                    {statusLine}
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto shrink-0 px-0"
                onClick={() => openInvoiceDialog("view", Number(invoiceId))}
              >
                View
              </Button>
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Delivery files
          </p>
          {invoiceFiles.length > 0 ? (
            invoiceFiles.map((file) => renderDeliverableDownloadRow(file))
          ) : (
            <p className="py-2 text-xs text-muted-foreground">
              No files on this invoice.
            </p>
          )}
        </div>
      </div>
    );
  };

  const renderInvoiceSection = () => (
    <Tabs
      value={selectedInvoiceTab || "new"}
      onValueChange={(value) =>
        setSelectedInvoiceTab(value as TicketInvoiceTabKey)
      }
      className="gap-3"
    >
        {invoiceHistoryIds.length > 0 ? (
          <TabsList className="h-auto w-full flex-wrap justify-start rounded-none p-1">
            {invoiceHistoryIds.map((invoiceId) => {
              const tabInvoice = invoicesById.get(invoiceId);
              return (
                <TabsTrigger
                  key={invoiceId}
                  value={invoiceTabKey(invoiceId)}
                  className="rounded-none text-xs"
                >
                  {formatInvoiceTabLabel(tabInvoice, invoiceId)}
                </TabsTrigger>
              );
            })}
            {showNewInvoiceTab ? (
              <TabsTrigger
                value="new"
                className="rounded-none text-xs"
              >
                <span className="inline-flex items-center gap-1">
                  New
                  {canDismissNewTab ? (
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="Cancel new invoice"
                      className="inline-flex rounded-sm p-0.5 hover:bg-muted"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleCancelNewCycle();
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          event.stopPropagation();
                          handleCancelNewCycle();
                        }
                      }}
                    >
                      <X className="size-3" />
                    </span>
                  ) : null}
                </span>
              </TabsTrigger>
            ) : null}
          </TabsList>
        ) : null}

        {invoiceHistoryIds.map((invoiceId) => (
          <TabsContent
            key={invoiceId}
            value={invoiceTabKey(invoiceId)}
            className="mt-0"
          >
            {renderInvoiceTabContent(invoiceId)}
          </TabsContent>
        ))}

        {showNewInvoiceTab ? (
          <TabsContent value="new" className="mt-0">
            {renderNewInvoiceTabContent()}
          </TabsContent>
        ) : null}
    </Tabs>
  );

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
                <FileText className="size-4" />
                {deliverables.length > 0 ? (
                  <span className="text-[10px] font-medium tabular-nums">
                    {deliverables.length}
                  </span>
                ) : null}
              </div>
            </TooltipTrigger>
            <TooltipContent side="left">
              Invoice ({deliverables.length} files)
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

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden",
          allowsDeliverableUpload && dragActive &&
            "ring-2 ring-inset ring-primary/30",
        )}
        onDragOver={allowsDeliverableUpload ? handleDragOver : undefined}
        onDragLeave={allowsDeliverableUpload ? handleDragLeave : undefined}
        onDrop={allowsDeliverableUpload ? handleDrop : undefined}
      >
        <input
          ref={deliverableInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => void queueDeliverableUploads(event.target.files)}
        />

        <CollapsibleToolsSection
          title="Invoice"
          expanded={invoiceExpanded}
          onExpandedChange={setInvoiceExpanded}
          titleAddon={
            showNewInvoiceButton ? (
              <div className="shrink-0" onClick={(event) => event.stopPropagation()}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-6 rounded-none"
                      disabled={newInvoiceMutation.isPending}
                      aria-label="New invoice"
                      onClick={handleNewInvoiceClick}
                    >
                      {newInvoiceMutation.isPending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Plus className="size-3.5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">New invoice</TooltipContent>
                </Tooltip>
              </div>
            ) : null
          }
          contentClassName="overflow-y-auto px-4 pb-4"
        >
          {renderInvoiceSection()}
        </CollapsibleToolsSection>

        <CollapsibleToolsSection
          title="Text client"
          icon={MessageSquare}
          expanded={smsExpanded}
          onExpandedChange={setSmsExpanded}
          headerAddon={
            <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-success">
              <span className="size-2 rounded-full bg-success" aria-hidden />
              SMS
            </span>
          }
          className={cn(smsExpanded && "flex min-h-0 flex-1 flex-col")}
          contentClassName={cn(smsExpanded && "flex min-h-0 flex-1 flex-col")}
        >
          <TicketToolsClientSms
            className="min-h-[14rem] flex-1"
            ticket={ticket}
            contact={contact}
            activeInvoice={activeSmsInvoice}
            deliverables={deliverables}
          />
        </CollapsibleToolsSection>
      </div>

      <TicketDeliverableBillingDialog
        open={billingDialogOpen}
        fileName={billingFileName}
        propertyAddress={propertyAddress}
        initial={billingInitial}
        confirmLabel={editingDeliverable ? "Save billing" : "Add deliverable"}
        onOpenChange={handleBillingDialogOpenChange}
        onConfirm={(selection) => void handleBillingConfirm(selection)}
      />
      <TicketInvoicePreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        ticket={ticket}
        company={company}
        contact={contact}
        onInvoiceSent={clearNewInvoiceCycle}
      />
      {dialogInvoiceId != null && invoicesById.get(String(dialogInvoiceId)) ? (
        <TicketInvoiceReminderDialog
          open={reminderOpen}
          onOpenChange={setReminderOpen}
          ticket={ticket}
          invoice={invoicesById.get(String(dialogInvoiceId))!}
          company={company}
          contact={contact}
        />
      ) : null}
      {dialogInvoiceId != null ? (
        <TicketInvoiceViewDialog
          open={invoiceDialogOpen}
          onOpenChange={setInvoiceDialogOpen}
          mode={invoiceDialogMode}
          invoiceId={dialogInvoiceId}
          company={company}
          contact={contact}
          ticket={ticket}
          onRequestRemind={() => setReminderOpen(true)}
          onInvoiceUpdated={refresh}
        />
      ) : null}
    </aside>
  );
};

/** @deprecated Use TicketBillingSidePanel in the detail layout */
export const TicketBillingPanel = TicketBillingSidePanel;
