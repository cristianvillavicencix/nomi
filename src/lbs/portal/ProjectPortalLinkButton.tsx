import { Copy, Globe } from "lucide-react";
import type { MouseEvent } from "react";
import { useNotify } from "ra-core";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProjectPortalLink } from "@/lbs/portal/useProjectPortalLink";
import type { LbsDeal } from "@/lbs/types";

export const ProjectPortalLinkButton = ({ record }: { record: LbsDeal }) => {
  const notify = useNotify();
  const { portalLink } = useProjectPortalLink(record);

  const handleCopy = async (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!portalLink) return;
    await navigator.clipboard.writeText(portalLink);
    notify("Portal link copied", { type: "info" });
  };

  if (!portalLink) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex shrink-0 cursor-not-allowed rounded-md p-0.5 text-muted-foreground/40">
              <Globe className="size-4" />
            </span>
          </TooltipTrigger>
          <TooltipContent>
            Create a client portal invite in the Delivery tab
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="inline-flex shrink-0 items-center">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href={portalLink}
              target="_blank"
              rel="noopener noreferrer"
              title="Open client portal"
              aria-label="Open client portal"
              className="inline-flex items-center rounded-md p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <Globe className="size-4" />
            </a>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="break-all">{portalLink}</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
              onClick={(event) => void handleCopy(event)}
              aria-label="Copy client portal link"
            >
              <Copy className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Copy portal link</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};
