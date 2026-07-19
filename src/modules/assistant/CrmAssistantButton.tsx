import { IconButton } from "@/components/ui/icon-button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PRODUCT_MARK_SRC } from "@/lib/branding";
import { cn } from "@/lib/utils";
import { CrmAssistantPanel } from "./CrmAssistantPanel";
import { useCrmAssistant } from "./useCrmAssistant";
import { useCrmAssistantAvailable } from "./useCrmAssistantAvailable";

type CrmAssistantButtonProps = {
  className?: string;
  /**
   * `header` — icon-only control in the global top bar (default for list hubs).
   * `fab` — floating button when the global header is hidden (Messages, project
   * show, proposal preview, mobile shell). Do not mount both on the same page.
   */
  variant?: "header" | "fab";
};

const SigmaMark = ({ className }: { className?: string }) => (
  <img
    src={PRODUCT_MARK_SRC}
    alt=""
    aria-hidden
    className={cn("object-contain", className)}
    draggable={false}
  />
);

export function CrmAssistantButton({
  className,
  variant = "header",
}: CrmAssistantButtonProps) {
  const { available } = useCrmAssistantAvailable();
  const assistant = useCrmAssistant();

  if (!available) return null;

  if (variant === "fab") {
    return (
      <>
        <IconButton
          variant="primary"
          className={cn(
            "fixed z-40 size-12 min-h-12 min-w-12 rounded-full shadow-lg",
            "bottom-20 right-4 md:bottom-6 md:right-6",
            className,
          )}
          aria-label="Ask Sigma"
          onClick={() => assistant.setOpen(true)}
        >
          <SigmaMark className="size-6" />
        </IconButton>
        <CrmAssistantPanel assistant={assistant} />
      </>
    );
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <IconButton
            variant="secondary"
            className={cn("size-9", className)}
            aria-label="Ask Sigma"
            onClick={() => assistant.setOpen(true)}
          >
            <SigmaMark className="size-4" />
          </IconButton>
        </TooltipTrigger>
        <TooltipContent>Ask Sigma</TooltipContent>
      </Tooltip>
      <CrmAssistantPanel assistant={assistant} />
    </>
  );
}
