import { Info } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const SettingsHint = ({ text }: { text: string }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <IconButton
        className="size-4 min-h-4 min-w-4 shrink-0 rounded-full text-muted-foreground/70 hover:bg-transparent hover:text-muted-foreground"
        aria-label="More info"
      >
        <Info className="size-3.5" />
      </IconButton>
    </TooltipTrigger>
    <TooltipContent side="top" className="max-w-xs text-balance">
      {text}
    </TooltipContent>
  </Tooltip>
);
