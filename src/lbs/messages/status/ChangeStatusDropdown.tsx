import { ChevronDown } from "lucide-react";
import { useNotify, useUpdate } from "ra-core";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Conversation } from "@/lbs/types";
import { StatusBadge } from "@/lbs/messages/status/StatusBadge";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";

const STATUSES: Conversation["status"][] = [
  "open",
  "pending",
  "closed",
  "urgent",
];

export const ChangeStatusDropdown = ({
  conversation,
}: {
  conversation: Conversation;
}) => {
  const canChange = useMemberCapability("messaging.status.change");
  const notify = useNotify();
  const [update] = useUpdate();
  const current = conversation.status ?? "open";

  if (!canChange) {
    return <StatusBadge status={current} />;
  }

  const handleChange = (status: Conversation["status"]) => {
    if (status === current) return;
    const now = new Date().toISOString();
    update(
      "conversations",
      {
        id: conversation.id,
        data: {
          status,
          closed_at: status === "closed" ? now : null,
        },
        previousData: conversation,
      },
      {
        onSuccess: () => notify("Status updated", { type: "success" }),
        onError: () => notify("Failed to update status", { type: "error" }),
      },
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2"
        >
          <StatusBadge status={current} />
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {STATUSES.map((status) => (
          <DropdownMenuItem key={status} onClick={() => handleChange(status)}>
            <StatusBadge status={status} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
