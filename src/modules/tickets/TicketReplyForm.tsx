import { useMutation } from "@tanstack/react-query";
import { Loader2, Paperclip, Send } from "lucide-react";
import { useState } from "react";
import {
  useDataProvider,
  useGetIdentity,
  useNotify,
  useRefresh,
} from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { Ticket } from "@/modules/types";
import { DEFAULT_TICKET_INBOX_EMAIL } from "@/modules/tickets/ticketInboxConfig";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const TicketReplyForm = ({ ticket }: { ticket: Ticket }) => {
  const [body, setBody] = useState("");
  const notify = useNotify();
  const refresh = useRefresh();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { identity } = useGetIdentity();

  const fromAddress = ticket.inbox_address?.trim() || DEFAULT_TICKET_INBOX_EMAIL;
  const toAddress = ticket.requester_email?.trim() || "—";

  const replyMutation = useMutation({
    mutationFn: () =>
      dataProvider.replyTicket({
        ticketId: ticket.id,
        body: body.trim(),
      }),
    onSuccess: (result) => {
      setBody("");
      refresh();
      if (result.email_sent) {
        notify("Reply sent", { type: "success" });
      } else if (result.email_skipped) {
        notify(
          "Reply saved. Email was not sent — check Communications settings.",
          { type: "warning" },
        );
      } else {
        notify("Reply sent", { type: "success" });
      }
    },
    onError: (error: Error) => {
      notify(error.message || "Failed to send reply", { type: "error" });
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) {
      notify("Message cannot be empty", { type: "warning" });
      return;
    }
    if (!ticket.requester_email?.trim()) {
      notify("This ticket has no requester email", { type: "warning" });
      return;
    }
    replyMutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border-t pt-4">
      <p className="text-xs text-muted-foreground">
        From <span className="font-medium text-foreground">{fromAddress}</span>
        {" · "}
        To <span className="font-medium text-foreground">{toAddress}</span>
        {identity?.fullName ? (
          <>
            {" · "}
            <span className="text-foreground">{identity.fullName}</span>
          </>
        ) : null}
      </p>
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Write your reply..."
        rows={4}
        className="min-h-[120px] resize-y"
      />
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" disabled>
          <Paperclip className="size-4" />
          Attach file
        </Button>
        <Button
          type="submit"
          disabled={replyMutation.isPending || !body.trim()}
        >
          {replyMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          Send reply
        </Button>
      </div>
    </form>
  );
};
