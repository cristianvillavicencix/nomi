import { CloudUpload, FileText, Loader2, Receipt } from "lucide-react";
import { useMemo, useRef, useState, type DragEvent } from "react";
import {
  useCreate,
  useGetList,
  useNotify,
  useRefresh,
  useUpdate,
} from "ra-core";
import type { Company, Contact } from "@/components/atomic-crm/types";
import type { Ticket, TicketDeliverable } from "@/modules/types";
import {
  getCombinedTicketInvoiceIssues,
  sortTicketsForCombinedInvoice,
  ticketHasLinkedClient,
  ticketHasReadyDeliverables,
  validateTicketsForCombinedInvoice,
} from "@/modules/tickets/combinedTicketInvoiceUtils";
import { EditTicketDialog } from "@/modules/tickets/EditTicketDialog";
import {
  TicketDeliverableBillingDialog,
  type DeliverableBillingSelection,
} from "@/modules/tickets/TicketDeliverableBillingDialog";
import { TicketCombinedInvoicePreviewDialog } from "@/modules/tickets/TicketCombinedInvoicePreviewDialog";
import {
  deliverableBillingShortLabel,
} from "@/modules/tickets/supplementPricing";
import { useTicketCatalogPackages } from "@/modules/catalog/useTicketCatalogPackages";
import {
  MAX_TICKET_ATTACHMENTS,
  MAX_TICKET_ATTACHMENT_BYTES,
  uploadTicketAttachment,
} from "@/modules/tickets/uploadTicketAttachment";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type TicketBulkCreateInvoiceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tickets: Ticket[];
  companyById: Map<string, Company>;
  contactById: Map<string, Contact>;
  onComplete?: () => void;
};

export const TicketBulkCreateInvoiceDialog = ({
  open,
  onOpenChange,
  tickets,
  companyById,
  contactById,
  onComplete,
}: TicketBulkCreateInvoiceDialogProps) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const [createDeliverable] = useCreate();
  const [updateTicket] = useUpdate();
  const [ticketIndex, setTicketIndex] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [billingDialogOpen, setBillingDialogOpen] = useState(false);
  const [pendingUploads, setPendingUploads] = useState<File[]>([]);
  const [billingFileName, setBillingFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [ticketToEdit, setTicketToEdit] = useState<Ticket | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { ticketPackages } = useTicketCatalogPackages();

  const sortedTickets = useMemo(
    () => sortTicketsForCombinedInvoice(tickets),
    [tickets],
  );
  const validationError = useMemo(
    () => validateTicketsForCombinedInvoice(tickets, companyById, contactById),
    [tickets, companyById, contactById],
  );
  const validationIssues = useMemo(
    () => getCombinedTicketInvoiceIssues(tickets, companyById, contactById),
    [tickets, companyById, contactById],
  );
  const clientIssueTicketId = validationIssues.find(
    (issue) => issue.kind === "client",
  )?.ticketId;

  const ticketIds = sortedTickets.map((ticket) => ticket.id);
  const currentTicket = sortedTickets[ticketIndex] ?? null;

  const { data: allDeliverables = [], refetch: refetchDeliverables } =
    useGetList<TicketDeliverable>(
      "ticket_deliverables",
      {
        filter: { "ticket_id@in": `(${ticketIds.join(",")})` },
        sort: { field: "sort_order", order: "ASC" },
        pagination: { page: 1, perPage: 200 },
      },
      { enabled: open && ticketIds.length > 0 },
    );

  const deliverablesByTicketId = useMemo(() => {
    const map = new Map<string, TicketDeliverable[]>();
    for (const file of allDeliverables) {
      const key = String(file.ticket_id);
      const current = map.get(key) ?? [];
      current.push(file);
      map.set(key, current);
    }
    return map;
  }, [allDeliverables]);

  const ticketsReady = sortedTickets.every((ticket) =>
    ticketHasReadyDeliverables(deliverablesByTicketId.get(String(ticket.id)) ?? []),
  );

  const currentDeliverables = currentTicket
    ? (deliverablesByTicketId.get(String(currentTicket.id)) ?? [])
    : [];
  const currentUnbilled = currentDeliverables.filter(
    (file) => !file.invoiced_invoice_id,
  );

  const resetState = () => {
    setTicketIndex(0);
    setPreviewOpen(false);
    setBillingDialogOpen(false);
    setPendingUploads([]);
    setBillingFileName(null);
    setUploading(false);
    setDragActive(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetState();
    onOpenChange(next);
  };

  const markDeliveryReady = async (ticket: Ticket) => {
    if (ticket.delivery_status !== "none") return;
    await updateTicket(
      "tickets",
      {
        id: ticket.id,
        data: { delivery_status: "ready" },
        previousData: ticket,
      },
      { mutationMode: "optimistic" },
    );
  };

  const openBillingForUpload = (files: File[]) => {
    setDragActive(false);
    setPendingUploads(files);
    setBillingFileName(files[0]?.name ?? null);
    setBillingDialogOpen(true);
  };

  const queueUploads = (files: FileList | null) => {
    if (!files?.length || !currentTicket) return;
    const fileArray = Array.from(files);
    if (currentDeliverables.length + fileArray.length > MAX_TICKET_ATTACHMENTS) {
      notify(`Maximum ${MAX_TICKET_ATTACHMENTS} files per ticket`, {
        type: "warning",
      });
      return;
    }
    for (const file of fileArray) {
      if (file.size > MAX_TICKET_ATTACHMENT_BYTES) {
        notify(`"${file.name}" exceeds the 10 MB limit`, { type: "warning" });
        return;
      }
    }
    openBillingForUpload(fileArray);
  };

  const handleBillingConfirm = async (selection: DeliverableBillingSelection) => {
    if (!currentTicket) return;
    const file = pendingUploads[0];
    if (!file) return;

    setUploading(true);
    try {
      const uploaded = await uploadTicketAttachment(file);
      await createDeliverable(
        "ticket_deliverables",
        {
          data: {
            ticket_id: currentTicket.id,
            title: uploaded.title,
            type: uploaded.type,
            path: uploaded.path,
            src: uploaded.src,
            sort_order: currentDeliverables.length,
            billing_kind: selection.billing_kind,
            billing_line_count: selection.billing_line_count,
            service_package_id: selection.service_package_id ?? null,
          },
        },
        { returnPromise: true },
      );

      await markDeliveryReady(currentTicket);

      const remaining = pendingUploads.slice(1);
      if (remaining.length > 0) {
        setPendingUploads(remaining);
        setBillingFileName(remaining[0].name);
        notify("Deliverable added", { type: "info" });
        await refetchDeliverables();
      } else {
        setBillingDialogOpen(false);
        setPendingUploads([]);
        setBillingFileName(null);
        notify("Deliverable added", { type: "success" });
        await refetchDeliverables();
        refresh();
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "Upload failed", {
        type: "error",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    queueUploads(event.dataTransfer.files);
  };

  const handleContinue = () => {
    if (validationError) {
      notify(validationError, { type: "warning" });
      return;
    }
    if (!ticketsReady) {
      notify("Add and bill delivery files for every selected ticket", {
        type: "warning",
      });
      return;
    }
    setPreviewOpen(true);
  };

  const handlePreviewClose = (next: boolean) => {
    setPreviewOpen(next);
    if (!next) {
      onComplete?.();
      handleOpenChange(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="size-4" />
              Create combined invoice
            </DialogTitle>
            <DialogDescription>
              Add delivery files for each ticket, then send one invoice to one
              email. Each ticket keeps its own thread after payment.
            </DialogDescription>
          </DialogHeader>

          {validationError ? (
            <div className="flex flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
              <p>{validationError}</p>
              {clientIssueTicketId != null ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    const ticket = sortedTickets.find(
                      (row) => String(row.id) === String(clientIssueTicketId),
                    );
                    if (ticket) setTicketToEdit(ticket);
                  }}
                >
                  Edit ticket #{clientIssueTicketId}
                </Button>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {sortedTickets.map((ticket, index) => {
              const ready = ticketHasReadyDeliverables(
                deliverablesByTicketId.get(String(ticket.id)) ?? [],
              );
              const hasClient = ticketHasLinkedClient(ticket);
              const statusLabel = !hasClient
                ? " · needs client"
                : ready
                  ? " · files ready"
                  : " · needs files";
              return (
                <Badge
                  key={ticket.id}
                  variant={index === ticketIndex ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer",
                    !hasClient && "border-destructive/40 text-destructive",
                  )}
                  onClick={() => setTicketIndex(index)}
                >
                  #{ticket.id}
                  {statusLabel}
                </Badge>
              );
            })}
          </div>

          {currentTicket ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">
                  Ticket #{currentTicket.id}
                </p>
                <p className="text-sm text-muted-foreground">
                  {currentTicket.subject?.trim() || "No subject"}
                </p>
              </div>

              <div
                className={cn(
                  "rounded-lg border border-dashed p-6 text-center transition-colors",
                  dragActive && "border-primary bg-primary/5",
                )}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
              >
                <CloudUpload className="mx-auto mb-2 size-8 text-muted-foreground" />
                <p className="text-sm font-medium">Drop delivery files here</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Up to {MAX_TICKET_ATTACHMENTS} files · 10 MB each
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose files
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(event) => queueUploads(event.target.files)}
                />
              </div>

              {currentUnbilled.length > 0 ? (
                <ul className="space-y-2">
                  {currentUnbilled.map((file) => (
                    <li
                      key={file.id}
                      className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
                    >
                      <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{file.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {deliverableBillingShortLabel(file, ticketPackages)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Upload at least one delivery file for this ticket.
                </p>
              )}
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Step {ticketIndex + 1} of {sortedTickets.length}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              {ticketIndex < sortedTickets.length - 1 ? (
                <Button
                  type="button"
                  disabled={!ticketHasReadyDeliverables(currentUnbilled)}
                  onClick={() => setTicketIndex((index) => index + 1)}
                >
                  Next ticket
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={Boolean(validationError) || !ticketsReady || uploading}
                  onClick={handleContinue}
                >
                  {uploading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  Review invoice
                </Button>
              )}
            </div>
            {!validationError && !ticketsReady ? (
              <p className="w-full text-xs text-muted-foreground">
                Add and bill delivery files for every selected ticket to continue.
              </p>
            ) : null}
            {validationError ? (
              <p className="w-full text-xs text-muted-foreground">
                Fix the issue above before reviewing the invoice.
              </p>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TicketDeliverableBillingDialog
        open={billingDialogOpen}
        fileName={billingFileName}
        propertyAddress={currentTicket?.subject ?? "Property"}
        confirmLabel="Add to delivery package"
        onOpenChange={(next) => {
          if (!next && !uploading) {
            setBillingDialogOpen(false);
            setPendingUploads([]);
            setBillingFileName(null);
          }
        }}
        onConfirm={handleBillingConfirm}
      />

      <TicketCombinedInvoicePreviewDialog
        open={previewOpen}
        onOpenChange={handlePreviewClose}
        tickets={sortedTickets}
        companyById={companyById}
        contactById={contactById}
        onInvoiceSent={() => {
          onComplete?.();
          handleOpenChange(false);
        }}
      />

      <EditTicketDialog
        ticket={ticketToEdit}
        open={ticketToEdit != null}
        onOpenChange={(next) => {
          if (!next) setTicketToEdit(null);
        }}
        onSaved={() => {
          refresh();
          setTicketToEdit(null);
        }}
      />
    </>
  );
};
