import { UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { useNotify, useUpdate, type Identifier } from "ra-core";
import type { OrganizationMember, Ticket } from "@/modules/types";
import { toneClass } from "@/modules/shared/status";
import {
  ticketStatusLabel,
  ticketStatusTone,
} from "@/modules/tickets/ticketInboxConfig";
import { memberDisplayName } from "@/modules/tickets/ticketInboxUi";
import { useTicketStatusChange } from "@/modules/tickets/useTicketStatusChange";
import { SignedMemberAvatarImage } from "@/components/avatar/SignedMemberAvatarImage";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  getMemberInitials,
  getMemberName,
} from "@/components/atomic-crm/tasks/taskMemberOptions";

const STATUS_OPTIONS = [
  { id: "new" },
  { id: "open" },
  { id: "waiting" },
  { id: "resolved" },
] as const;

export const TicketListStatusControl = ({
  ticket,
  canManage,
  onUpdated,
}: {
  ticket: Ticket;
  canManage: boolean;
  onUpdated?: () => void;
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { applyStatusChange, statusChangeDialog } =
    useTicketStatusChange(onUpdated);

  const handleChange = (status: string) => {
    if (!canManage) return;
    setMenuOpen(false);
    applyStatusChange(ticket, status);
  };

  const trigger = (
    <button
      type="button"
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-full border bg-background",
        canManage ? "hover:bg-muted" : "cursor-default",
      )}
      title={ticketStatusLabel(ticket.status)}
      onClick={(event) => event.stopPropagation()}
    >
      <span
        className={cn(
          "size-2.5 rounded-full",
          toneClass(ticketStatusTone(ticket.status), "dot"),
        )}
        aria-hidden
      />
    </button>
  );

  if (!canManage) return trigger;

  return (
    <>
      {statusChangeDialog}
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-40 p-1"
          onClick={(event) => event.stopPropagation()}
        >
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                ticket.status === option.id && "bg-muted/60",
              )}
              onClick={() => handleChange(option.id)}
            >
              <span
                className={cn(
                  "size-2.5 rounded-full",
                  toneClass(ticketStatusTone(option.id), "dot"),
                )}
              />
              <span className="capitalize">{ticketStatusLabel(option.id)}</span>
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </>
  );
};

export const TicketListAssigneeControl = ({
  ticket,
  assignee,
  members,
  canManage,
  onUpdated,
}: {
  ticket: Ticket;
  assignee?: OrganizationMember | null;
  members: OrganizationMember[];
  canManage: boolean;
  onUpdated?: () => void;
}) => {
  const notify = useNotify();
  const [update] = useUpdate();

  const activeMembers = useMemo(
    () => members.filter((member) => member.disabled !== true),
    [members],
  );

  const handleChange = (assigneeId: Identifier | null) => {
    if (!canManage) return;
    update(
      "tickets",
      {
        id: ticket.id,
        data: { assignee_id: assigneeId },
        previousData: ticket,
      },
      {
        onSuccess: () => {
          notify("Ticket assigned", { type: "success" });
          onUpdated?.();
        },
        onError: () => notify("Failed to assign ticket", { type: "error" }),
      },
    );
  };

  const name = assignee ? getMemberName(assignee) : "Unassigned";

  const trigger = (
    <button
      type="button"
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-full border bg-background",
        canManage ? "hover:bg-muted" : "cursor-default",
      )}
      title={name}
      onClick={(event) => event.stopPropagation()}
    >
      <Avatar className="size-6">
        {assignee ? (
          <SignedMemberAvatarImage member={assignee} size={48} alt={name} />
        ) : null}
        <AvatarFallback className="text-[10px] font-medium">
          {assignee ? (
            getMemberInitials(assignee)
          ) : (
            <UserRound className="size-3.5 text-muted-foreground" />
          )}
        </AvatarFallback>
      </Avatar>
    </button>
  );

  if (!canManage) return trigger;

  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-52 max-h-64 overflow-y-auto p-1"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className={cn(
            "flex w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
            !ticket.assignee_id && "bg-muted/60",
          )}
          onClick={() => handleChange(null)}
        >
          Unassigned
        </button>
        {activeMembers.map((member) => (
          <button
            key={String(member.id)}
            type="button"
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
              String(ticket.assignee_id) === String(member.id) && "bg-muted/60",
            )}
            onClick={() => handleChange(member.id)}
          >
            <Avatar className="size-6">
              <SignedMemberAvatarImage
                member={member}
                size={48}
                alt={memberDisplayName(member) ?? "Member"}
              />
              <AvatarFallback className="text-[10px]">
                {getMemberInitials(member)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">{memberDisplayName(member)}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
};
