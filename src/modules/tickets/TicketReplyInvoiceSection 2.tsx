import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { CloudUpload, FileText, Loader2, Pencil, Send, Trash2 } from "lucide-react";
import {
  useCreate,
  useDelete,
  useNotify,
  useRefresh,
  useUpdate,
} from "ra-core";
import type { Company, Contact } from "@/components/atomic-crm/types";
import type { ClientInvoice, Ticket, TicketDeliverable } from "@/modules/types";
import {
  calculateTicketPricing,
  deliverableBillingLineTotal,
  deliverableBillingShortLabel,
  formatSupplementMoney,
} from "@/modules/tickets/supplementPricing";
import {
  TicketDeliverableBillingDialog,
  type DeliverableBillingSelection,
} from "@/modules/tickets/TicketDeliverableBillingDialog";
import { TicketInvoicePreviewDialog } from "@/modules/tickets/TicketInvoicePreviewDialog";
import { resolveTicketRequesterEmail } from "@/modules/tickets/ticketRequester";
import { useTicketCatalogPackages } from "@/modules/catalog/useTicketCatalogPackages";
import {
  MAX_TICKET_ATTACHMENTS,
  MAX_TICKET_ATTACHMENT_BYTES,
  uploadTicketAttachment,
} from "@/modules/tickets/uploadTicketAttachment";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";

export type TicketReplyInvoiceSectionHandle = {
  openUpload: (files?: File[]) => void;
  openInvoicePreview: () => void;
};

type TicketReplyInvoiceSectionProps = {
  ticket: Ticket;
  invoice: ClientInvoice | null;
  company?: Company | null;
  contact?: Contact | null;
  deliverables: TicketDeliverable[];
  unbilledDeliverables: TicketDeliverable[];
  deliverablesReadyForInvoice: boolean;
  onInvoiceSent?: () => void;
};

export const TicketReplyInvoiceSection = forwardRef<
  TicketReplyInvoiceSectionHandle,
  TicketReplyInvoiceSectionProps
>(function TicketReplyInvoiceSection(
  {
    ticket,
    invoice,
    company,
    contact,
    deliverables,
    unbilledDeliverables,
    deliverablesReadyForInvoice,
    onInvoiceSent,
  },
  ref,
) {
  const notify = useNotify();
  const refresh = useRefresh();
  const [createDeliverable] = useCreate();
  const [updateDeliverable] = useUpdate();
  const [deleteDeliverable] = useDelete();
  const { ticketPackages } = useTicketCatalogPackages();
  const deliverableInputRef = useRef<HTMLInputElement | null>(null);
  const [billingDialogOpen, setBillingDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pendingUploads, setPendingUploads] = useState<File[]>([]);
  const [editingDeliverable, setEditingDeliverable] =
    useState<TicketDeliverable | null>(null);
  const [billingFileName, setBillingFileName] = useState<string | null>(null);
  const [billingInitial, setBillingInitial] =
    useState<DeliverableBillingSelection | null>(null);
  const [uploadingDeliverables, setUploadingDeliverables] = useState(false);

  const propertyAddress = ticket.subject ?? "Property";

  const pricing = useMemo(
    () =>
      unbilledDeliverables.length > 0
        ? calculateTicketPricing(
            unbilledDeliverables,
            ticket,
            propertyAddress,
            ticketPackages,
          )
        : null,
    [propertyAddress, ticket, ticketPackages, unbilledDeliverables],
  );

  const invoiceBlocksSend =
    invoice?.status === "sent" || invoice?.status === "paid";

  const canCreateInvoice =
    unbilledDeliverables.length > 0 &&
    deliverablesReadyForInvoice &&
    ticket.delivery_status !== "delivered" &&
    !invoiceBlocksSend;

  const openInvoicePreview = useCallback(() => {
    if (!unbilledDeliverables.length) {
      notify(
        "Upload at least one delivery file before sending an invoice",
        { type: "warning" },
      );
      deliverableInputRef.current?.click();
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
    if (!canCreateInvoice) {
      notify("This invoice cannot be sent in the current ticket state", {
        type: "warning",
      });
      return;
    }
    setPreviewOpen(true);
  }, [
    canCreateInvoice,
    company,
    contact,
    deliverablesReadyForInvoice,
    notify,
    ticket,
    unbilledDeliverables.length,
  ]);

  const markDeliveryReady = async () => {
    if (ticket.delivery_status !== "none") return;
    await updateDeliverable(
      "tickets",
      {
        id: ticket.id,
        data: { delivery_status: "ready" },
        previousData: ticket,
      },
      { mutationMode: "optimistic" },
    );
  };

  const openBillingDialogForUpload = useCallback((files: File[]) => {
    setEditingDeliverable(null);
    setPendingUploads(files);
    setBillingFileName(files[0]?.name ?? null);
    setBillingInitial(null);
    setBillingDialogOpen(true);
  }, []);

  const openBillingDialogForEdit = (deliverable: TicketDeliverable) => {
    setEditingDeliverable(deliverable);
    setPendingUploads([]);
    setBillingFileName(deliverable.title);
    setBillingInitial(
      deliverable.billing_kind || deliverable.service_package_id
        ? {
            billing_kind: deliverable.billing_kind ?? "supplement",
            billing_line_count: deliverable.billing_line_count ?? null,
            service_package_id: deliverable.service_package_id ?? null,
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

  const queueDeliverableUploads = useCallback(
    (files: FileList | File[] | null) => {
      const fileArray = files
        ? Array.from(files instanceof FileList ? files : files)
        : [];
      if (fileArray.length === 0) return;

      if (deliverables.length + fileArray.length > MAX_TICKET_ATTACHMENTS) {
        notify(`Maximum ${MAX_TICKET_ATTACHMENTS} files`, { type: "warning" });
        return;
      }

      for (const file of fileArray) {
        if (file.size > MAX_TICKET_ATTACHMENT_BYTES) {
          notify(
            `"${file.name}" exceeds the ${Math.round(MAX_TICKET_ATTACHMENT_BYTES / (1024 * 1024))} MB limit`,
            { type: "warning" },
          );
          return;
        }
      }

      openBillingDialogForUpload(fileArray);
    },
    [deliverables.length, notify, openBillingDialogForUpload],
  );

  useImperativeHandle(
    ref,
    () => ({
      openUpload: (files) => {
        if (files?.length) {
          queueDeliverableUploads(files);
          return;
        }
        deliverableInputRef.current?.click();
      },
      openInvoicePreview,
    }),
    [openInvoicePreview, queueDeliverableUploads],
  );

  const handleBillingConfirm = async (selection: DeliverableBillingSelection) => {
    if (editingDeliverable) {
      try {
        await updateDeliverable(
          "ticket_deliverables",
          {
            id: editingDeliverable.id,
            data: {
              billing_kind: selection.billing_kind,
              billing_line_count: selection.billing_line_count,
              service_package_id: selection.service_package_id ?? null,
            },
            previousData: editingDeliverable,
          },
          { returnPromise: true },
        );
        notify("Billing updated", { type: "info" });
        handleBillingDialogOpenChange(false);
        refresh();
      } catch (error) {
        notify(
          error instanceof Error ? error.message : "Could not save billing",
          { type: "error" },
        );
      }
      return;
    }

    const file = pendingUploads[0];
    if (!file) return;

    setUploadingDeliverables(true);
    try {
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
            service_package_id: selection.service_package_id ?? null,
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

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    queueDeliverableUploads(event.dataTransfer.files);
  };

  return (
    <>
      <div className="border-b border-primary/20 bg-primary/5 px-4 py-3 md:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">Delivery files for invoice</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {unbilledDeliverables.length === 0
                ? "Upload billable files here — they are not email attachments."
                : deliverablesReadyForInvoice
                  ? `${unbilledDeliverables.length} file${unbilledDeliverables.length === 1 ? "" : "s"} ready to invoice.`
                  : `${unbilledDeliverables.length} file${unbilledDeliverables.length === 1 ? "" : "s"} uploaded — set billing type for each.`}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="shrink-0"
            disabled={uploadingDeliverables}
            onClick={() => deliverableInputRef.current?.click()}
          >
            {uploadingDeliverables ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <CloudUpload className="mr-1.5 size-4" />
            )}
            Upload files
          </Button>
        </div>

        {unbilledDeliverables.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {unbilledDeliverables.map((file) => {
              const amount = deliverableBillingLineTotal(
                file,
                propertyAddress,
                ticketPackages,
              );
              const billingLabel = deliverableBillingShortLabel(
                file,
                ticketPackages,
              );
              const needsBilling =
                !file.billing_kind && !file.service_package_id;

              return (
                <li
                  key={file.id}
                  className={cn(
                    "rounded-md border bg-background/80 px-3 py-2.5",
                    needsBilling ? "border-warning/40" : "border-primary/20",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2">
                      <FileText className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate text-sm" title={file.title}>
                          {file.title}
                        </p>
                        <p
                          className={cn(
                            "mt-0.5 text-xs",
                            needsBilling
                              ? "font-medium text-warning"
                              : "text-muted-foreground",
                          )}
                        >
                          {needsBilling ? "Set billing type" : billingLabel}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-0.5">
                      <IconButton
                        aria-label={
                          needsBilling ? "Set billing type" : "Edit billing"
                        }
                        className="size-7"
                        onClick={() => openBillingDialogForEdit(file)}
                      >
                        <Pencil className="size-3.5" />
                      </IconButton>
                      <IconButton
                        aria-label="Remove deliverable"
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
                      </IconButton>
                    </div>
                  </div>
                  {amount != null ? (
                    <p className="mt-2 border-t border-border/60 pt-2 text-right text-xs font-medium tabular-nums">
                      {formatSupplementMoney(amount)}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}

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
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
          className="mt-2 cursor-pointer rounded-md border border-dashed border-primary/30 bg-background/80 px-3 py-2.5 text-center text-xs text-muted-foreground transition-colors hover:bg-background"
        >
          Drop .esx, PDF, or photos here to add them to the invoice
        </div>

        {unbilledDeliverables.length > 0 && pricing ? (
          <div className="mt-3 space-y-2 border-t border-primary/15 pt-3">
            <div className="space-y-1 text-xs">
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
              className="h-9 w-full"
              disabled={!canCreateInvoice}
              onClick={openInvoicePreview}
            >
              <Send className="mr-1.5 size-4" />
              Create invoice & request payment
            </Button>
          </div>
        ) : null}

        <input
          ref={deliverableInputRef}
          type="file"
          className="hidden"
          multiple
          onChange={(event) => {
            queueDeliverableUploads(event.target.files);
            event.target.value = "";
          }}
        />

        <TicketDeliverableBillingDialog
          open={billingDialogOpen}
          fileName={billingFileName}
          propertyAddress={propertyAddress}
          initial={billingInitial}
          confirmLabel={editingDeliverable ? "Save billing" : "Add deliverable"}
          onOpenChange={handleBillingDialogOpenChange}
          onConfirm={(selection) => void handleBillingConfirm(selection)}
        />
      </div>

      <TicketInvoicePreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        ticket={ticket}
        company={company}
        contact={contact}
        onInvoiceSent={() => {
          setPreviewOpen(false);
          onInvoiceSent?.();
        }}
      />
    </>
  );
});
