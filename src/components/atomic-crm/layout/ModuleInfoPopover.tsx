import { CircleHelp, Info } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export const ModuleInfoPopover = ({
  title,
  description,
  bullets,
  contextTitle,
  contextDescription,
}: {
  title: string;
  description: string;
  /** Optional short steps so users see the intended workflow at a glance */
  bullets?: string[];
  /** Replaces a full-width info Alert: shown in a compact Info popover beside About. */
  contextTitle?: string;
  contextDescription?: ReactNode;
}) => (
  <div className="flex shrink-0 items-center gap-0.5">
    {contextDescription != null ? (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            aria-label={
              contextTitle
                ? `Module tip: ${contextTitle}`
                : `Tip about ${title}`
            }
            title={contextTitle ?? `About ${title}`}
          >
            <Info className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 space-y-2 p-3">
          {contextTitle ? (
            <p className="text-sm font-medium leading-tight">{contextTitle}</p>
          ) : null}
          <div className="text-xs leading-relaxed text-muted-foreground">
            {contextDescription}
          </div>
        </PopoverContent>
      </Popover>
    ) : null}
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          aria-label={`About ${title}`}
          title={`About ${title}`}
        >
          <CircleHelp className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-2 p-3">
        <p className="text-sm font-medium leading-tight">{title}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
        {bullets?.length ? (
          <ol className="mt-1 list-decimal space-y-1.5 pl-4 text-xs text-muted-foreground">
            {bullets.map((line, index) => (
              <li key={index} className="leading-relaxed">
                {line}
              </li>
            ))}
          </ol>
        ) : null}
      </PopoverContent>
    </Popover>
  </div>
);
