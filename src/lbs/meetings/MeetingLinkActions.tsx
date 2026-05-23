import { useState, type ReactNode } from "react";
import { Copy, RefreshCw, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getMeetingRoomLabel } from "@/lbs/meetings/jitsiMeeting";

type MeetingLinkActionsProps = {
  meetingUrl?: string | null;
  onRegenerate?: () => void;
  variant?: "icons" | "field";
  className?: string;
};

const MeetingIconButton = ({
  label,
  onClick,
  href,
  children,
  className,
}: {
  label: string;
  onClick?: () => void;
  href?: string;
  children: ReactNode;
  className?: string;
}) => {
  const button = href ? (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className={cn("size-8 shrink-0", className)}
      asChild
    >
      <a href={href} target="_blank" rel="noreferrer" aria-label={label}>
        {children}
      </a>
    </Button>
  ) : (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className={cn("size-8 shrink-0", className)}
      onClick={onClick}
      aria-label={label}
    >
      {children}
    </Button>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
};

export const MeetingLinkActions = ({
  meetingUrl,
  onRegenerate,
  variant = "icons",
  className,
}: MeetingLinkActionsProps) => {
  const [copied, setCopied] = useState(false);

  if (!meetingUrl?.trim()) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(meetingUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const actions = (
    <>
      <MeetingIconButton label="Join call" href={meetingUrl}>
        <Video className="size-4" />
      </MeetingIconButton>
      <MeetingIconButton
        label={copied ? "Copied" : "Copy link"}
        onClick={handleCopy}
      >
        <Copy className="size-4" />
      </MeetingIconButton>
      {onRegenerate ? (
        <MeetingIconButton label="New link" onClick={onRegenerate}>
          <RefreshCw className="size-4" />
        </MeetingIconButton>
      ) : null}
    </>
  );

  if (variant === "field") {
    const roomLabel = getMeetingRoomLabel(meetingUrl);

    return (
      <TooltipProvider delayDuration={300}>
        <div
          className={cn(
            "flex items-center overflow-hidden rounded-md border bg-background",
            className,
          )}
        >
          <div className="relative min-w-0 flex-1">
            <p
              className="truncate px-3 py-2 text-sm font-medium"
              title={meetingUrl}
            >
              {roomLabel}
            </p>
            <div
              className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background via-background/80 to-transparent"
              aria-hidden
            />
          </div>
          <div className="flex shrink-0 items-center border-l pl-0.5 pr-1">
            {actions}
          </div>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn("flex items-center justify-end gap-0.5", className)}>
        {actions}
      </div>
    </TooltipProvider>
  );
};
