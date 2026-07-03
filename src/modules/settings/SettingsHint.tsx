import { Info } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const SettingsHint = ({ text }: { text: string }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        type="button"
        className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 hover:text-muted-foreground"
        aria-label="More info"
      >
        <Info className="size-3.5" />
      </button>
    </TooltipTrigger>
    <TooltipContent side="top" className="max-w-xs text-balance">
      {text}
    </TooltipContent>
  </Tooltip>
);
