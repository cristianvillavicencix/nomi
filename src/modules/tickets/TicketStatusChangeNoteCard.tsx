import { ArrowRight } from "lucide-react";
import { StatusPill } from "@/modules/shared/status";
import {
  ticketStatusLabel,
  ticketStatusTone,
} from "@/modules/tickets/ticketInboxConfig";
import {
  parseStatusChangeInternalNote,
} from "@/modules/tickets/parseStatusChangeInternalNote";
import { InternalNotePlainBody } from "@/modules/tickets/InternalNotePlainBody";

export const TicketStatusChangeNoteCard = ({
  body,
}: {
  body?: string | null;
}) => {
  const note = parseStatusChangeInternalNote(body);
  if (!note) return null;

  return (
    <div className="mt-2 border-l-2 border-warning pl-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[13px] font-semibold text-foreground">
          Status changed
        </span>
        <StatusPill
          tone={ticketStatusTone(note.fromStatus)}
          className="h-5 px-1.5 text-[11px] font-medium capitalize"
        >
          {ticketStatusLabel(note.fromStatus)}
        </StatusPill>
        <ArrowRight
          className="size-3 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <StatusPill
          tone={ticketStatusTone(note.toStatus)}
          className="h-5 px-1.5 text-[11px] font-medium capitalize"
        >
          {ticketStatusLabel(note.toStatus)}
        </StatusPill>
      </div>
      {note.note ? (
        <div className="mt-1.5">
          <InternalNotePlainBody text={note.note} />
        </div>
      ) : null}
    </div>
  );
};
