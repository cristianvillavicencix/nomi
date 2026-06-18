import { useMemo } from "react";
import { useNotify, useUpdate, type Identifier } from "ra-core";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OrganizationMember, Ticket } from "@/modules/types";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import { memberDisplayName } from "@/modules/tickets/ticketInboxUi";

export const TicketAssignSelect = ({
  ticket,
  members,
  onAssigned,
}: {
  ticket: Ticket;
  members: OrganizationMember[];
  onAssigned?: () => void;
}) => {
  const canManage = useMemberCapability("support.tickets.manage");
  const notify = useNotify();
  const [update] = useUpdate();

  const activeMembers = useMemo(
    () =>
      members
        .filter((member) => member.disabled !== true)
        .sort((a, b) =>
          `${a.first_name ?? ""} ${a.last_name ?? ""}`.localeCompare(
            `${b.first_name ?? ""} ${b.last_name ?? ""}`,
          ),
        ),
    [members],
  );

  if (!canManage) return null;

  const value =
    ticket.assignee_id != null ? String(ticket.assignee_id) : "none";

  const handleChange = (nextValue: string) => {
    const nextAssignee =
      nextValue === "none"
        ? null
        : (Number(nextValue) as unknown as Identifier);

    update(
      "tickets",
      {
        id: ticket.id,
        data: { assignee_id: nextAssignee },
        previousData: ticket,
      },
      {
        onSuccess: () => {
          notify("Ticket assigned", { type: "success" });
          onAssigned?.();
        },
        onError: () => notify("Failed to assign ticket", { type: "error" }),
      },
    );
  };

  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger className="h-9 min-w-[140px] rounded-full">
        <SelectValue placeholder="Assign" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Unassigned</SelectItem>
        {activeMembers.map((member) => (
          <SelectItem key={String(member.id)} value={String(member.id)}>
            {memberDisplayName(member)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
