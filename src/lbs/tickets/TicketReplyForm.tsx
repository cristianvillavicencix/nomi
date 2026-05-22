import { useState } from "react";
import { useCreate, useGetIdentity, useNotify, useRefresh } from "ra-core";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Ticket, TicketMessage } from "@/lbs/types";

export const TicketReplyForm = ({ ticket }: { ticket: Ticket }) => {
  const [body, setBody] = useState("");
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const refresh = useRefresh();
  const [create, { isPending }] = useCreate();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) {
      notify("Message cannot be empty", { type: "warning" });
      return;
    }

    create(
      "ticket_messages",
      {
        data: {
          ticket_id: ticket.id,
          body: trimmed,
          author_member_id: identity?.id,
        } satisfies Partial<TicketMessage>,
      },
      {
        onSuccess: () => {
          setBody("");
          refresh();
          notify("Reply added");
        },
        onError: () => {
          notify("Failed to add reply", { type: "error" });
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 border-t pt-4">
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Write a reply..."
        rows={4}
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending || !body.trim()}>
          Send reply
        </Button>
      </div>
    </form>
  );
};
