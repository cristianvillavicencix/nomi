import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  parseInvoiceSentInternalNote,
  type InvoiceSentInternalNote,
} from "@/modules/tickets/parseInvoiceSentInternalNote";

const DetailLine = ({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) => {
  if (!value?.trim() || value.trim() === "—") return null;
  return (
    <p className="truncate text-[11px] leading-4 text-muted-foreground">
      <span className="text-foreground/55">{label}</span> {value}
    </p>
  );
};

const InvoiceSentNoteBody = ({ note }: { note: InvoiceSentInternalNote }) => {
  const [open, setOpen] = useState(false);

  const hasDelivery = note.deliverables.length > 0;
  const hasTimeline = Boolean(
    note.timelineOpened || note.timelinePackageReady || note.timelineSent,
  );
  const hasMeta = Boolean(note.from || note.by || note.to || note.text);
  const canExpand = hasDelivery || hasTimeline || hasMeta;

  const metaBits = [
    note.dueDate ? `Due ${note.dueDate}` : null,
    note.turnaroundTotal ? `${note.turnaroundTotal} turnaround` : null,
    hasDelivery
      ? `${note.deliverables.length} file${note.deliverables.length === 1 ? "" : "s"} after payment`
      : null,
  ].filter(Boolean);

  const timelineBits = [
    note.timelineOpened ? `Opened ${note.timelineOpened}` : null,
    note.timelinePackageReady
      ? `Package ${note.timelinePackageReady}`
      : null,
    note.timelineSent ? `Sent ${note.timelineSent}` : null,
  ].filter(Boolean);

  return (
    <div className="mt-2 border-l-2 border-amber-400/70 pl-2.5 dark:border-amber-500/50">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          <span className="text-[13px] font-semibold text-foreground">
            Invoice sent
          </span>
          {note.invoiceNumber ? (
            <span className="font-mono text-[11px] text-muted-foreground">
              {note.invoiceNumber}
            </span>
          ) : null}
          {note.amountDue ? (
            <span className="text-[13px] font-semibold tabular-nums text-foreground">
              {note.amountDue}
            </span>
          ) : null}
        </div>

        {metaBits.length > 0 ? (
          <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
            {metaBits.join(" · ")}
          </p>
        ) : null}

        {note.property ? (
          <p className="mt-0.5 truncate text-[11px] leading-4 text-foreground/75">
            {note.property}
          </p>
        ) : null}

        {(note.to || note.text) && !open ? (
          <p className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground">
            {[note.to ? `To ${note.to}` : null, note.text]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
      </div>

      {canExpand ? (
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-1 h-auto gap-0.5 px-0 py-0 text-[11px] font-medium text-amber-800/80 hover:bg-transparent hover:text-amber-950 dark:text-amber-200/80 dark:hover:text-amber-100"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
          >
            {open ? "Less" : "More"}
            <ChevronDown
              className={cn(
                "size-3 transition-transform duration-150 ease-out",
                open && "rotate-180",
              )}
            />
          </Button>

          {open ? (
            <div className="mt-1.5 space-y-1 border-t border-amber-300/25 pt-1.5 dark:border-amber-500/20">
              <DetailLine label="From" value={note.from} />
              <DetailLine label="By" value={note.by} />
              <DetailLine label="To" value={note.to} />
              <DetailLine label="Text" value={note.text} />

              {timelineBits.length > 0 ? (
                <p className="truncate text-[11px] leading-4 text-muted-foreground">
                  <span className="text-foreground/55">Timeline</span>{" "}
                  {timelineBits.join(" → ")}
                </p>
              ) : null}

              {note.deliverables.map((item) => (
                <p
                  key={`${item.title}-${item.detail}`}
                  className="truncate text-[11px] leading-4 text-muted-foreground"
                >
                  <span className="text-foreground/55">File</span> {item.title}
                  {item.detail ? (
                    <span className="text-foreground/45"> · {item.detail}</span>
                  ) : null}
                </p>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
};

export const TicketInvoiceSentNoteCard = ({
  body,
}: {
  body?: string | null;
}) => {
  const note = parseInvoiceSentInternalNote(body);
  if (!note) return null;
  return <InvoiceSentNoteBody note={note} />;
};
