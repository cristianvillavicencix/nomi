import { CheckCircle2, GitMerge, Trash2, X } from "lucide-react";
import { useState } from "react";
import {
  useDelete,
  useNotify,
  useRefresh,
} from "ra-core";
import type { Ticket } from "@/modules/types";
import { TicketBulkMergeDialog } from "@/modules/tickets/TicketBulkMergeDialog";
import { TicketBulkResolveDialog } from "@/modules/tickets/TicketBulkResolveDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type TicketInboxBulkBarProps = {
  selectedTickets: Ticket[];
  onClear: () => void;
  onMerged: (primaryTicketId: string | number) => void;
};

export const TicketInboxBulkBar = ({
  selectedTickets,
  onClear,
  onMerged,
}: TicketInboxBulkBarProps) => {
  const [mergeOpen, setMergeOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const notify = useNotify();
  const refresh = useRefresh();
  const [deleteOne] = useDelete();

  if (!selectedTickets.length) return null;

  const count = selectedTickets.length;

  const runDelete = async () => {
    setPending(true);
    try {
      for (const ticket of selectedTickets) {
        await deleteOne("tickets", {
          id: ticket.id,
          previousData: ticket,
        });
      }
      notify(`Deleted ${count} ticket(s)`, { type: "success" });
      onClear();
      refresh();
    } catch {
      notify("Could not delete selected tickets", { type: "error" });
    } finally {
      setPending(false);
      setDeleteOpen(false);
    }
  };

  const runResolve = () => setResolveOpen(true);

  return (
    <>
      <Card className="fixed bottom-2 left-0 right-0 z-50 mx-auto flex w-[90%] flex-col items-stretch gap-2 bg-muted p-2 px-4 sm:w-fit md:flex-row md:items-center md:gap-4">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            className="has-[>svg]:px-0"
            onClick={onClear}
          >
            <X className="size-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {count} ticket{count === 1 ? "" : "s"} selected
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            disabled={count < 2 || pending}
            onClick={() => setMergeOpen(true)}
          >
            <GitMerge className="size-3.5" />
            Merge
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            disabled={pending}
            onClick={() => void runResolve()}
          >
            <CheckCircle2 className="size-3.5" />
            Mark resolved
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-destructive hover:text-destructive"
            disabled={pending}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        </div>
      </Card>

      <TicketBulkMergeDialog
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        tickets={selectedTickets}
        onMerged={(primaryTicketId) => {
          onClear();
          onMerged(primaryTicketId);
        }}
      />

      <TicketBulkResolveDialog
        open={resolveOpen}
        tickets={selectedTickets}
        onOpenChange={setResolveOpen}
        onResolved={onClear}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete {count} ticket{count === 1 ? "" : "s"}?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently deletes the selected tickets and their messages.
            This action cannot be undone.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => void runDelete()}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
