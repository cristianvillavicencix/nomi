import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  ticketStatusLabel,
  ticketStatusVariant,
} from "@/modules/tickets/ticketInboxConfig";
import {
  parseStatusChangeInternalNote,
} from "@/modules/tickets/parseStatusChangeInternalNote";
import { InternalNotePlainBody } from "@/modules/tickets/InternalNotePlainBody";

const StatusPill = ({ status }: { status: string }) => (
  <Badge
    variant={ticketStatusVariant(status)}
    className="h-5 px-1.5 text-[11px] font-medium capitalize"
  >
    {ticketStatusLabel(status)}
  </Badge>
);

export const TicketStatusChangeNoteCard = ({
  body,
}: {
  body?: string | null;
}) => {
  const note = parseStatusChangeInternalNote(body);
  if (!note) return null;

  return (
    <div className="mt-2 border-l-2 border-amber-400/70 pl-2.5 dark:border-amber-500/50">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[13px] font-semibold text-foreground">
          Status changed
        </span>
        <StatusPill status={note.fromStatus} />
        <ArrowRight
          className="size-3 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <StatusPill status={note.toStatus} />
      </div>
      {note.note ? (
        <div className="mt-1.5">
          <InternalNotePlainBody text={note.note} />
        </div>
      ) : null}
    </div>
  );
};
