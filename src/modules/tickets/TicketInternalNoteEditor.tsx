import { useState } from "react";
import { CircleX, Edit, Save } from "lucide-react";
import { useNotify, useUpdate } from "ra-core";
import type { TicketMessage } from "@/modules/types";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Textarea } from "@/components/ui/textarea";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";

export const TicketInternalNoteEditor = ({
  message,
  onDone,
}: {
  message: TicketMessage;
  onDone: () => void;
}) => {
  const [body, setBody] = useState(message.body ?? "");
  const [update, { isPending }] = useUpdate();
  const notify = useNotify();

  const handleSave = () => {
    const trimmed = body.trim();
    if (!trimmed) {
      notify("Note cannot be empty", { type: "warning" });
      return;
    }

    update(
      "ticket_messages",
      {
        id: message.id,
        data: { body: trimmed },
        previousData: message,
      },
      {
        onSuccess: () => {
          notify("Note updated", { type: "success" });
          onDone();
        },
        onError: () => notify("Could not update note", { type: "error" }),
      },
    );
  };

  return (
    <div className="mt-2 space-y-2">
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={4}
        className="min-h-24 resize-y bg-background text-sm"
        disabled={isPending}
      />
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={onDone}
        >
          <CircleX className="size-4" />
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={handleSave}
        >
          <Save className="size-4" />
          Save note
        </Button>
      </div>
    </div>
  );
};

export const TicketInternalNoteActions = ({
  onEdit,
}: {
  onEdit: () => void;
}) => {
  const canEdit = useMemberCapability("support.tickets.manage");

  if (!canEdit) return null;

  return (
    <IconButton
      className="size-7 shrink-0"
      aria-label="Edit internal note"
      onClick={(event) => {
        event.stopPropagation();
        onEdit();
      }}
    >
      <Edit className="size-3.5" />
    </IconButton>
  );
};
