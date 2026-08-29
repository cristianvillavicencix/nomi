import type { MouseEvent } from "react";
import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { useNotify, useUpdate } from "ra-core";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Ticket } from "@/modules/types";
import {
  getTicketServiceTypeLabels,
  normalizeTicketServiceTypes,
  TICKET_SERVICE_TYPE_OPTIONS,
  toggleTicketServiceType,
  type TicketServiceTypeId,
} from "@/modules/tickets/ticketKanbanCardMeta";

type TicketServiceTypeChipsProps = {
  ticket: Ticket;
  canManage?: boolean;
  onUpdated?: () => void;
  className?: string;
};

export const TicketServiceTypeChips = ({
  ticket,
  canManage = false,
  onUpdated,
  className,
}: TicketServiceTypeChipsProps) => {
  const notify = useNotify();
  const [update, { isPending }] = useUpdate();
  const [open, setOpen] = useState(false);
  const selected = normalizeTicketServiceTypes(ticket.service_types);
  const labels = getTicketServiceTypeLabels(ticket);

  const stopBubble = (event: MouseEvent) => {
    event.stopPropagation();
  };

  const persist = (next: TicketServiceTypeId[]) => {
    if (!canManage) return;
    update(
      "tickets",
      {
        id: ticket.id,
        data: { service_types: next },
        previousData: ticket,
      },
      {
        onSuccess: () => {
          onUpdated?.();
        },
        onError: () => {
          notify("Could not update ticket type", { type: "error" });
        },
      },
    );
  };

  const trigger = (
    <button
      type="button"
      className={cn(
        "inline-flex max-w-full flex-wrap items-center gap-1 rounded-md text-left",
        canManage && "hover:bg-muted/60",
        className,
      )}
      onClick={stopBubble}
      onPointerDown={stopBubble}
      disabled={!canManage || isPending}
      title={
        canManage
          ? labels.length > 0
            ? "Change ticket type"
            : "Set ticket type"
          : undefined
      }
    >
      {labels.length > 0 ? (
        labels.map((label) => (
          <span
            key={label}
            className="rounded border border-border/70 bg-muted/40 px-1.5 py-px text-[10px] font-medium text-foreground/80"
          >
            {label}
          </span>
        ))
      ) : canManage ? (
        <span className="inline-flex items-center gap-0.5 rounded border border-dashed border-border/80 px-1.5 py-px text-[10px] text-muted-foreground">
          <Plus className="size-2.5" aria-hidden />
          Type
        </span>
      ) : (
        <span className="text-[10px] text-muted-foreground/70">No type</span>
      )}
    </button>
  );

  if (!canManage) return trigger;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-48 p-1"
        onClick={stopBubble}
        onPointerDown={stopBubble}
      >
        <p className="px-2 py-1.5 text-[11px] font-medium text-muted-foreground">
          Ticket type
        </p>
        {TICKET_SERVICE_TYPE_OPTIONS.map((option) => {
          const active = selected.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                active && "bg-muted/70",
              )}
              onClick={() => persist(toggleTicketServiceType(selected, option.id))}
            >
              <Check
                className={cn(
                  "size-3.5 shrink-0",
                  active ? "opacity-100" : "opacity-0",
                )}
                aria-hidden
              />
              <span className="truncate">{option.label}</span>
            </button>
          );
        })}
        {selected.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-1 h-7 w-full justify-start text-xs text-muted-foreground"
            onClick={() => {
              persist([]);
              setOpen(false);
            }}
          >
            Clear types
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
};
