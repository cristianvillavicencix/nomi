import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, GitMerge, Lightbulb } from "lucide-react";
import {
  useDataProvider,
  useNotify,
  useRefresh,
  type Identifier,
} from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { Ticket } from "@/modules/types";
import { ticketStatusLabel } from "@/modules/tickets/ticketInboxConfig";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const TicketBulkMergeMultiDialog = ({
  open,
  onOpenChange,
  tickets,
  onMerged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tickets: Ticket[];
  onMerged?: (primaryTicketId: Identifier) => void;
}) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [step, setStep] = useState<"setup" | "confirm">("setup");

  const defaultPrimaryId = useMemo(() => {
    const sorted = [...tickets].sort((a, b) => {
      const aTime = new Date(a.updated_at ?? 0).getTime();
      const bTime = new Date(b.updated_at ?? 0).getTime();
      return bTime - aTime;
    });
    return String(sorted[0]?.id ?? "");
  }, [tickets]);

  const [primaryId, setPrimaryId] = useState(defaultPrimaryId);

  const primaryTicket = tickets.find((ticket) => String(ticket.id) === primaryId);
  const secondaryTickets = tickets.filter(
    (ticket) => String(ticket.id) !== primaryId,
  );

  const mergeMutation = useMutation({
    mutationFn: () =>
      dataProvider.mergeTickets({
        primaryTicketId: primaryId,
        mergeTicketIds: secondaryTickets.map((ticket) => ticket.id),
      }),
    onSuccess: (result) => {
      notify(
        `Merged ${result.merged_ticket_ids.length} ticket(s) into #${result.primary_ticket_id}`,
        { type: "success" },
      );
      onOpenChange(false);
      refresh();
      onMerged?.(result.primary_ticket_id);
    },
    onError: (error: Error) => {
      notify(error.message || "Failed to merge tickets", { type: "error" });
    },
  });

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setPrimaryId(defaultPrimaryId);
      setStep("setup");
    } else if (!mergeMutation.isPending) {
      setStep("setup");
    }
    onOpenChange(nextOpen);
  };

  if (tickets.length < 3) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,900px)] w-[min(96vw,48rem)] max-w-[min(96vw,48rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(96vw,48rem)]">
        <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4 text-left">
          <DialogTitle className="text-lg">
            Merge {tickets.length} tickets
          </DialogTitle>
          <DialogDescription>
            {step === "setup"
              ? "Choose the primary ticket to keep. All messages from the other tickets move into that thread."
              : "Review the merge before confirming. This action cannot be undone."}
          </DialogDescription>
        </DialogHeader>

        {step === "setup" ? (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="ticket-merge-multi-primary">Primary ticket</Label>
              <Select value={primaryId} onValueChange={setPrimaryId}>
                <SelectTrigger id="ticket-merge-multi-primary">
                  <SelectValue placeholder="Select primary ticket" />
                </SelectTrigger>
                <SelectContent>
                  {tickets.map((ticket) => (
                    <SelectItem key={String(ticket.id)} value={String(ticket.id)}>
                      #{ticket.id} · {ticket.subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {primaryTicket ? (
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Primary ticket
                </p>
                <p className="mt-2 text-sm font-semibold">{primaryTicket.subject}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">
                    #{primaryTicket.id}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {ticketStatusLabel(primaryTicket.status)}
                  </Badge>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <p className="text-sm font-medium">
                Tickets to merge in ({secondaryTickets.length})
              </p>
              <ul className="max-h-56 space-y-2 overflow-y-auto rounded-xl border p-3">
                {secondaryTickets.map((ticket) => (
                  <li
                    key={String(ticket.id)}
                    className="flex flex-wrap items-center gap-2 text-sm"
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      #{ticket.id}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{ticket.subject}</span>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {ticketStatusLabel(ticket.status)}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-sm text-muted-foreground">
              Field values stay as they are on the primary ticket. To compare
              fields side by side, merge two tickets at a time.
            </p>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    Merge {secondaryTickets.length} ticket(s) into #{primaryId}?
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Secondary tickets will be marked resolved and hidden from the
                    inbox.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-warning/25 bg-warning/8 p-4">
                <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Lightbulb className="size-4 text-warning" />
                  Things to remember
                </p>
                <ul className="space-y-2 text-xs leading-relaxed text-muted-foreground">
                  <li>All messages move to the primary thread.</li>
                  <li>Primary ticket field values are kept.</li>
                  <li>Secondary tickets stay linked for reference.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="shrink-0 gap-2 border-t bg-muted/15 px-6 py-4">
          {step === "setup" ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!primaryId || secondaryTickets.length === 0}
                onClick={() => setStep("confirm")}
              >
                Continue
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={mergeMutation.isPending}
                onClick={() => setStep("setup")}
              >
                Back
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={mergeMutation.isPending}
                onClick={() => mergeMutation.mutate()}
              >
                <GitMerge className="size-4" />
                Yes, merge {secondaryTickets.length} tickets
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
