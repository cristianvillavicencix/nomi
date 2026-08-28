import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  useDataProvider,
  useGetList,
  useNotify,
  useRefresh,
  type Identifier,
} from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { Ticket } from "@/modules/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type MoveMode = "new" | "existing";

export const TicketMoveMessagesDialog = ({
  open,
  onOpenChange,
  mode,
  sourceTicket,
  messageIds,
  onMoved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: MoveMode;
  sourceTicket: Ticket;
  messageIds: Identifier[];
  onMoved?: (targetTicketId: Identifier, createdNew: boolean) => void;
}) => {
  const dataProvider = useDataProvider() as CrmDataProvider;
  const notify = useNotify();
  const refresh = useRefresh();
  const count = messageIds.length;

  const defaultSubject = `Split from #${sourceTicket.id}: ${sourceTicket.subject}`;
  const [subject, setSubject] = useState(defaultSubject);
  const [search, setSearch] = useState("");
  const [targetId, setTargetId] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setSubject(defaultSubject);
    setSearch("");
    setTargetId("");
  }, [open, defaultSubject]);

  const searchFilter = useMemo(() => {
    const base: Record<string, unknown> = {
      "merged_into_ticket_id@is": null,
      "id@neq": sourceTicket.id,
    };
    const token = search.trim();
    if (!token) return base;
    if (/^\d+$/.test(token)) {
      return { ...base, "id@eq": Number(token) };
    }
    return { ...base, "subject@ilike": token };
  }, [search, sourceTicket.id]);

  const { data: candidates = [], isLoading: candidatesLoading } =
    useGetList<Ticket>(
      "tickets",
      {
        filter: searchFilter,
        pagination: { page: 1, perPage: 12 },
        sort: { field: "updated_at", order: "DESC" },
      },
      { enabled: open && mode === "existing" },
    );

  const mutation = useMutation({
    mutationFn: async () => {
      if (mode === "new") {
        return dataProvider.moveTicketMessages({
          sourceTicketId: sourceTicket.id,
          messageIds,
          createNew: true,
          subject: subject.trim() || defaultSubject,
          status: "open",
        });
      }
      const id = Number(targetId);
      if (!Number.isFinite(id)) {
        throw new Error("Select a target ticket");
      }
      return dataProvider.moveTicketMessages({
        sourceTicketId: sourceTicket.id,
        messageIds,
        targetTicketId: id,
      });
    },
    onSuccess: (result) => {
      notify(
        count === 1
          ? `Moved 1 message to ticket #${result.target_ticket_id}`
          : `Moved ${count} messages to ticket #${result.target_ticket_id}`,
        { type: "success" },
      );
      refresh();
      onOpenChange(false);
      onMoved?.(result.target_ticket_id, result.created_new);
    },
    onError: (error) => {
      notify(
        error instanceof Error ? error.message : "Failed to move messages",
        { type: "error" },
      );
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "new" ? "Move to new ticket" : "Move to existing ticket"}
          </DialogTitle>
          <DialogDescription>
            {count === 1
              ? "Move 1 selected message out of this thread."
              : `Move ${count} selected messages out of this thread.`}
          </DialogDescription>
        </DialogHeader>

        {mode === "new" ? (
          <div className="space-y-2">
            <Label htmlFor="split-ticket-subject">Subject</Label>
            <Input
              id="split-ticket-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              disabled={mutation.isPending}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="split-ticket-search">Find ticket</Label>
              <Input
                id="split-ticket-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by id or subject…"
                disabled={mutation.isPending}
              />
            </div>
            <ul className="max-h-56 overflow-y-auto rounded-md border">
              {candidatesLoading ? (
                <li className="px-3 py-2 text-sm text-muted-foreground">
                  Loading…
                </li>
              ) : candidates.length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted-foreground">
                  No tickets found.
                </li>
              ) : (
                candidates.map((ticket) => {
                  const selected = String(ticket.id) === targetId;
                  return (
                    <li key={ticket.id}>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted/60",
                          selected && "bg-muted",
                        )}
                        disabled={mutation.isPending}
                        onClick={() => setTargetId(String(ticket.id))}
                      >
                        <span className="font-medium">
                          #{ticket.id} · {ticket.subject}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {ticket.status}
                          {ticket.requester_email
                            ? ` · ${ticket.requester_email}`
                            : ""}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={mutation.isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={
              mutation.isPending ||
              (mode === "existing" && !targetId) ||
              (mode === "new" && !subject.trim())
            }
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Moving…" : "Move messages"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
