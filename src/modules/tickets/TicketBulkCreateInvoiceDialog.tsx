import { FileText, Loader2, Plus, Receipt, Trash2, Upload } from "lucide-react";
import { useMemo, useRef, useState, useEffect } from "react";
import {
  useCreate,
  useDelete,
  useGetList,
  useNotify,
  useRefresh,
  useUpdate,
} from "ra-core";
import type { Company, Contact } from "@/components/atomic-crm/types";
import type { Ticket, TicketDeliverable } from "@/modules/types";
import {
  getCombinedRecipientEmailOptions,
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

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
  const [deleteDeliverable] = useDelete();
  const [updateTicket] = useUpdate();
  const [ticketIndex, setTicketIndex] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [billingDialogOpen, setBillingDialogOpen] = useState(false);
  const [pendingUploads, setPendingUploads] = useState<File[]>([]);
  const [billingFileName, setBillingFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [ticketToEdit, setTicketToEdit] = useState<Ticket | null>(null);
  const [selectedRecipientEmail, setSelectedRecipientEmail] = useState("");
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
  const primaryIssue = validationIssues[0] ?? null;
  const recipientEmailOptions = useMemo(
    () => getCombinedRecipientEmailOptions(tickets, companyById, contactById),
    [tickets, companyById, contactById],
  );
  const needsRecipientChoice = recipientEmailOptions.length > 1;
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

  useEffect(() => {
    if (!open) return;
    setSelectedRecipientEmail((current) => {
      if (
        current &&
        recipientEmailOptions.some((option) => option.email === current)
      ) {
        return current;
      }
      return recipientEmailOptions[0]?.email ?? "";
    });
  }, [open, recipientEmailOptions]);

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
    setSelectedRecipientEmail("");
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
    setPendingUploads(files);
    setBillingFileName(files[0]?.name ?? null);
    setBillingDialogOpen(true);
  };

  const canAddMoreFiles =
    currentDeliverables.length < MAX_TICKET_ATTACHMENTS;

  const openFilePicker = () => {
    if (!canAddMoreFiles || uploading) return;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
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

  const handleDeleteDeliverable = async (file: TicketDeliverable) => {
    try {
      await deleteDeliverable(
        "ticket_deliverables",
        { id: file.id, previousData: file },
        { mutationMode: "optimistic", returnPromise: true },
      );
      await refetchDeliverables();
      refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not remove file", {
        type: "error",
      });
    }
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
        <DialogContent className="flex max-h-[min(92vh,44rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="size-4" />
              Create combined invoice
            </DialogTitle>
            <DialogDescription>
              Add delivery files for each ticket, then send one invoice to one
              email. Each ticket keeps its own thread after payment.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {primaryIssue ? (
            <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <p className="font-medium">{primaryIssue.message}</p>
                  {primaryIssue.kind === "email" && primaryIssue.recipients ? (
                    <ul className="space-y-1 text-xs sm:text-sm">
                      {primaryIssue.recipients.map((recipient) => {
                        const email = recipient.email?.trim();
                        const name = recipient.name?.trim();
                        return (
                          <li key={String(recipient.ticketId)}>
                            <span className="font-medium">
                              #{recipient.ticketId}
                            </span>
                            {name ? (
                              <span className="text-destructive/90">
                                {" "}
                                · {name}
                              </span>
                            ) : null}
                            {email ? (
                              <span className="text-destructive/90">
                                {" "}
                                · {email}
                              </span>
                            ) : (
                              <span className="text-destructive/80">
                                {" "}
                                · no email
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
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
            </div>
          ) : needsRecipientChoice ? (
            <div className="space-y-3 rounded-md border bg-muted/30 px-3 py-3 text-sm">
              <div>
                <p className="font-medium">Choose invoice recipient</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  These tickets have different emails. Pick one address for the
                  combined invoice.
                </p>
              </div>
              <RadioGroup
                value={selectedRecipientEmail}
                onValueChange={setSelectedRecipientEmail}
                className="gap-2"
              >
                {recipientEmailOptions.map((option) => (
                  <label
                    key={option.email}
                    htmlFor={`combined-recipient-${option.email}`}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-md border bg-background px-3 py-2.5 transition-colors",
                      selectedRecipientEmail === option.email &&
                        "border-primary/50 bg-primary/5",
                    )}
                  >
                    <RadioGroupItem
                      value={option.email}
                      id={`combined-recipient-${option.email}`}
                      className="mt-0.5"
                    />
                    <div className="min-w-0">
                      <p className="font-medium">{option.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Tickets{" "}
                        {option.ticketIds.map((id) => `#${id}`).join(", ")}
                        {option.names.length
                          ? ` · ${option.names.join(", ")}`
                          : ""}
                      </p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </div>
          ) : selectedRecipientEmail ? (
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <p className="text-muted-foreground">
                Invoice will be sent to{" "}
                <span className="font-medium text-foreground">
                  {selectedRecipientEmail}
                </span>
              </p>
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
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">
                  Ticket #{currentTicket.id}
                </p>
                <p className="text-sm text-muted-foreground">
                  {currentTicket.subject?.trim() || "No subject"}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Delivery files</p>
                  <p className="text-xs text-muted-foreground">
                    {currentDeliverables.length}/{MAX_TICKET_ATTACHMENTS} · 10
                    MB max
                  </p>
                </div>

                <div className="overflow-hidden rounded-md border">
                  {currentUnbilled.length > 0 ? (
                    <ul className="divide-y">
                      {currentUnbilled.map((file) => (
                        <li
                          key={file.id}
                          className="flex items-center gap-2 px-3 py-2.5 text-sm"
                        >
                          <FileText className="size-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{file.title}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {deliverableBillingShortLabel(
                                file,
                                ticketPackages,
                              )}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                            disabled={uploading}
                            aria-label={`Remove ${file.title}`}
                            onClick={() => void handleDeleteDeliverable(file)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {canAddMoreFiles ? (
                    <div
                      className={cn(
                        "flex items-center gap-2 px-3 py-2.5",
                        currentUnbilled.length > 0 && "border-t bg-muted/20",
                      )}
                    >
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-w-0 flex-1 justify-start gap-2"
                        disabled={uploading}
                        onClick={openFilePicker}
                      >
                        {uploading ? (
                          <Loader2 className="size-4 shrink-0 animate-spin" />
                        ) : (
                          <Upload className="size-4 shrink-0" />
                        )}
                        Upload file
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-8 shrink-0"
                        disabled={uploading}
                        aria-label="Add another file"
                        onClick={openFilePicker}
                      >
                        <Plus className="size-4" />
                      </Button>
                    </div>
                  ) : null}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(event) => {
                    queueUploads(event.target.files);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                />
              </div>
            </div>
          ) : null}
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t px-6 py-4 sm:justify-between">
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
                  disabled={
                    Boolean(validationError) ||
                    !ticketsReady ||
                    uploading ||
                    !selectedRecipientEmail.trim()
                  }
                  onClick={handleContinue}
                >
                  {uploading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  Review invoice
                </Button>
              )}
            </div>
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
        selectedRecipientEmail={selectedRecipientEmail}
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
