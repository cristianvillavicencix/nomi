import { Paperclip } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SkippedAttachmentsNote } from "@/modules/tickets/parseSkippedAttachmentsNote";
import { cn } from "@/lib/utils";

export const SkippedAttachmentsNotice = ({
  note,
  className,
}: {
  note: SkippedAttachmentsNote;
  className?: string;
}) => {
  const label =
    note.count === 1
      ? "1 attachment was not imported"
      : `${note.count} attachments were not imported`;

  return (
    <div
      className={cn(
        "mt-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-100",
        className,
      )}
    >
      <Paperclip className="mt-0.5 size-3.5 shrink-0 text-amber-700 dark:text-amber-300" />
      <div className="min-w-0 space-y-0.5">
        <p className="font-medium">{label}</p>
        <p className="text-amber-800/80 dark:text-amber-200/80">
          Max 10 attachments per inbound email. Files above the limit were not
          saved.
        </p>
        {note.lines.length > 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="text-left font-medium text-amber-800 underline-offset-2 hover:underline dark:text-amber-200"
              >
                View skipped names
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              className="max-h-48 max-w-xs overflow-y-auto text-left"
            >
              <ul className="space-y-0.5">
                {note.lines.map((line) => (
                  <li key={`${line.title}-${line.reason}`}>
                    {line.title}
                    <span className="text-muted-foreground">
                      {" "}
                      ({line.sizeLabel}, {line.reason})
                    </span>
                  </li>
                ))}
              </ul>
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
};
