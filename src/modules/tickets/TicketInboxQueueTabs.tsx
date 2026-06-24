import { cn } from "@/lib/utils";
import {
  TICKET_INBOX_QUEUES,
  type TicketInboxQueueId,
} from "@/modules/tickets/ticketInboxQueue";

export const TicketInboxQueueTabs = ({
  activeQueue,
  counts,
  onChange,
}: {
  activeQueue: TicketInboxQueueId;
  counts: Record<TicketInboxQueueId, number>;
  onChange: (queue: TicketInboxQueueId) => void;
}) => (
  <div className="flex flex-wrap gap-1.5">
    {TICKET_INBOX_QUEUES.map((queue) => {
      const count = counts[queue.id] ?? 0;
      return (
        <button
          key={queue.id}
          type="button"
          onClick={() => onChange(queue.id)}
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
            activeQueue === queue.id
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
          )}
        >
          {queue.label}
          {count > 0 ? <span className="ml-1 opacity-80">· {count}</span> : null}
        </button>
      );
    })}
  </div>
);
