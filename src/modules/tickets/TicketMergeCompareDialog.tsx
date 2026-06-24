import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, GitMerge, Lightbulb, Lock } from "lucide-react";
import {
  useDataProvider,
  useGetList,
  useGetOne,
  useNotify,
  useRefresh,
  type Identifier,
} from "ra-core";
import type { Company, Contact } from "@/components/atomic-crm/types";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { Deal, OrganizationMember, Ticket } from "@/modules/types";
import {
  buildTicketMergeFieldOverrides,
  buildTicketMergeRows,
  buildTicketMergeSnapshot,
  defaultTicketMergeFieldSides,
  type TicketMergeFieldKey,
  type TicketMergeRow,
} from "@/modules/tickets/ticketMergeCompare";
import {
  ticketStatusLabel,
  ticketStatusVariant,
} from "@/modules/tickets/ticketInboxConfig";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const MUTABLE_FIELDS: TicketMergeFieldKey[] = [
  "requester_name",
  "requester_email",
  "phone",
  "subject",
  "status",
  "priority",
  "assignee_id",
  "company_id",
  "contact_id",
  "deal_id",
];

const STATUS_DOT: Record<string, string> = {
  new: "bg-info",
  open: "bg-success",
  waiting: "bg-warning",
  resolved: "bg-muted-foreground/60",
};

type TicketMergeCompareDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leftTicket: Ticket;
  rightTicket: Ticket;
  onMerged?: (primaryTicketId: Identifier) => void;
};

const useTicketMergeEnrichment = (ticket: Ticket) => {
  const { data: contact } = useGetOne<Contact>(
    "contacts",
    { id: ticket.contact_id ?? "" },
    { enabled: Boolean(ticket.contact_id) },
  );
  const { data: company } = useGetOne<Company>(
    "companies",
    { id: ticket.company_id ?? "" },
    { enabled: Boolean(ticket.company_id) },
  );
  const { data: deal } = useGetOne<Deal>(
    "deals",
    { id: ticket.deal_id ?? "" },
    { enabled: Boolean(ticket.deal_id) },
  );
  return { contact, company, deal };
};

const MergeValueCell = ({
  value,
  selected,
  locked,
  onSelect,
}: {
  value: string;
  selected: boolean;
  locked?: boolean;
  onSelect: () => void;
}) => {
  if (locked) {
    return (
      <div className="flex h-full min-h-12 items-center px-5 py-3 text-sm text-muted-foreground">
        {value}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex h-full min-h-12 w-full items-start gap-3 px-5 py-3 text-left text-sm transition-colors",
        selected
          ? "bg-primary/6 ring-1 ring-inset ring-primary/25"
          : "hover:bg-muted/40",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border shadow-xs",
          selected
            ? "border-primary bg-primary"
            : "border-input bg-background",
        )}
        aria-hidden
      >
        {selected ? <span className="size-1.5 rounded-full bg-primary-foreground" /> : null}
      </span>
      <span className="min-w-0 flex-1 break-words leading-snug">{value}</span>
    </button>
  );
};

export const TicketMergeCompareDialog = ({
  open,
  onOpenChange,
  leftTicket,
  rightTicket,
  onMerged,
}: TicketMergeCompareDialogProps) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [step, setStep] = useState<"compare" | "confirm">("compare");
  const [primarySide, setPrimarySide] = useState<"left" | "right">("left");
  const [fieldSides, setFieldSides] = useState<
    Record<TicketMergeFieldKey, "left" | "right">
  >(() => defaultTicketMergeFieldSides("left"));

  const leftEnrichment = useTicketMergeEnrichment(leftTicket);
  const rightEnrichment = useTicketMergeEnrichment(rightTicket);

  const { data: members = [] } = useGetList<OrganizationMember>(
    "organization_members",
    {
      pagination: { page: 1, perPage: 200 },
      sort: { field: "first_name", order: "ASC" },
    },
    { enabled: open },
  );

  const memberById = useMemo(
    () => new Map(members.map((member) => [String(member.id), member])),
    [members],
  );

  const leftSnapshot = useMemo(
    () =>
      buildTicketMergeSnapshot({
        ticket: leftTicket,
        contact: leftEnrichment.contact,
        company: leftEnrichment.company,
        dealName: leftEnrichment.deal?.name,
        assignee: leftTicket.assignee_id
          ? memberById.get(String(leftTicket.assignee_id))
          : null,
      }),
    [leftEnrichment, leftTicket, memberById],
  );

  const rightSnapshot = useMemo(
    () =>
      buildTicketMergeSnapshot({
        ticket: rightTicket,
        contact: rightEnrichment.contact,
        company: rightEnrichment.company,
        dealName: rightEnrichment.deal?.name,
        assignee: rightTicket.assignee_id
          ? memberById.get(String(rightTicket.assignee_id))
          : null,
      }),
    [memberById, rightEnrichment, rightTicket],
  );

  const rows = useMemo(
    () => buildTicketMergeRows(leftSnapshot, rightSnapshot),
    [leftSnapshot, rightSnapshot],
  );

  const primaryTicketId =
    primarySide === "left" ? leftTicket.id : rightTicket.id;
  const secondaryTicketId =
    primarySide === "left" ? rightTicket.id : leftTicket.id;

  useEffect(() => {
    if (!open) return;
    setStep("compare");
    setPrimarySide("left");
    setFieldSides(defaultTicketMergeFieldSides("left"));
  }, [open, leftTicket.id, rightTicket.id]);

  const handlePrimaryChange = (side: "left" | "right") => {
    setPrimarySide(side);
    setFieldSides(defaultTicketMergeFieldSides(side));
  };

  const setAllFields = (side: "left" | "right", checked: boolean) => {
    if (!checked) return;
    setFieldSides(defaultTicketMergeFieldSides(side));
  };

  const mergeMutation = useMutation({
    mutationFn: () =>
      dataProvider.mergeTickets({
        primaryTicketId,
        mergeTicketIds: [secondaryTicketId],
        fieldOverrides: buildTicketMergeFieldOverrides(
          leftSnapshot,
          rightSnapshot,
          fieldSides,
        ),
      }),
    onSuccess: (result) => {
      notify(`Merged ticket into #${result.primary_ticket_id}`, {
        type: "success",
      });
      onOpenChange(false);
      refresh();
      onMerged?.(result.primary_ticket_id);
    },
    onError: (error: Error) => {
      notify(error.message || "Failed to merge tickets", { type: "error" });
    },
  });

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !mergeMutation.isPending) {
      setStep("compare");
    }
    onOpenChange(nextOpen);
  };

  const columnHeader = (
    ticket: Ticket,
    side: "left" | "right",
    snapshot: typeof leftSnapshot,
  ) => {
    const isPrimary = primarySide === side;
    const allSelected = MUTABLE_FIELDS.every(
      (field) => fieldSides[field] === side,
    );

    return (
      <div
        className={cn(
          "flex h-full flex-col gap-3 border-l p-5",
          isPrimary && "bg-primary/[0.03]",
        )}
      >
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="radio"
            name="ticket-merge-primary"
            className="mt-1 size-4 accent-primary"
            checked={isPrimary}
            onChange={() => handlePrimaryChange(side)}
          />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                #{ticket.id}
              </span>
              {isPrimary ? (
                <Badge variant="secondary" className="h-5 px-2 text-[10px]">
                  Primary
                </Badge>
              ) : null}
            </div>
            <p className="line-clamp-3 text-sm font-semibold leading-snug text-foreground">
              {snapshot.subject}
            </p>
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "size-2 rounded-full",
                  STATUS_DOT[ticket.status] ?? "bg-muted-foreground/60",
                )}
              />
              <Badge
                variant={ticketStatusVariant(ticket.status)}
                className="h-5 px-2 text-[10px] capitalize"
              >
                {ticketStatusLabel(ticket.status)}
              </Badge>
            </div>
          </div>
        </label>

        <label className="flex cursor-pointer items-center gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          <Checkbox
            checked={allSelected}
            onCheckedChange={(checked) =>
              setAllFields(side, checked === true)
            }
          />
          Select all values
        </label>
      </div>
    );
  };

  const renderFieldRow = (row: TicketMergeRow) => {
    const fieldKey = row.key as TicketMergeFieldKey;
    const isMutable = !row.locked && MUTABLE_FIELDS.includes(fieldKey);

    return (
      <div
        key={row.key}
        className="grid grid-cols-[12rem_minmax(0,1fr)_minmax(0,1fr)]"
      >
        <div className="flex items-center gap-1.5 bg-muted/25 px-5 py-3 text-sm font-medium text-muted-foreground">
          {row.label}
          {row.locked ? <Lock className="size-3 opacity-50" /> : null}
        </div>

        <div className="border-l border-border/70">
          <MergeValueCell
            value={row.left}
            selected={isMutable && fieldSides[fieldKey] === "left"}
            locked={row.locked}
            onSelect={() =>
              setFieldSides((current) => ({ ...current, [fieldKey]: "left" }))
            }
          />
        </div>

        <div className="border-l border-border/70">
          <MergeValueCell
            value={row.right}
            selected={isMutable && fieldSides[fieldKey] === "right"}
            locked={row.locked}
            onSelect={() =>
              setFieldSides((current) => ({ ...current, [fieldKey]: "right" }))
            }
          />
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={step === "compare"}
        className="flex max-h-[min(92vh,900px)] w-[min(96vw,80rem)] max-w-[min(96vw,80rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(96vw,80rem)]"
      >
        <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4 text-left">
          <DialogTitle className="text-lg">Merge tickets</DialogTitle>
          {step === "compare" ? (
            <DialogDescription>
              Choose the primary ticket, then pick which value to keep for each
              field. All messages from the other ticket move into the primary
              thread.
            </DialogDescription>
          ) : (
            <DialogDescription>
              Review the merge before confirming. This action cannot be undone.
            </DialogDescription>
          )}
        </DialogHeader>

        {step === "compare" ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <div className="overflow-hidden rounded-xl border border-border/80 bg-background shadow-sm">
              <div className="grid grid-cols-[12rem_minmax(0,1fr)_minmax(0,1fr)] border-b border-border/80 bg-muted/35">
                <div className="px-5 py-3.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Field
                </div>
                {columnHeader(leftTicket, "left", leftSnapshot)}
                {columnHeader(rightTicket, "right", rightSnapshot)}
              </div>

              <div className="divide-y divide-border/70">
                {rows.map(renderFieldRow)}
              </div>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    Merge ticket #{secondaryTicketId} into #{primaryTicketId}?
                  </p>
                  <p className="text-sm text-muted-foreground">
                    The secondary ticket will be marked resolved and hidden from
                    the inbox.
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
                  <li>Selected field values are saved on the primary ticket.</li>
                  <li>The secondary ticket stays linked for reference.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="shrink-0 gap-2 border-t bg-muted/15 px-6 py-4">
          {step === "compare" ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="button" onClick={() => setStep("confirm")}>
                <GitMerge className="size-4" />
                Continue
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={mergeMutation.isPending}
                onClick={() => setStep("compare")}
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
                Yes, merge
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
