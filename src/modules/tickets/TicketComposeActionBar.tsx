import { ChevronDown, Forward, Lock, Reply, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type TicketComposeOpenMode = "reply" | "forward" | "internal";

export const TicketComposeActionBar = ({
  canReplyAndCharge = false,
  onOpen,
  className,
}: {
  canReplyAndCharge?: boolean;
  onOpen: (
    mode: TicketComposeOpenMode,
    options?: { replyIntent?: "reply" | "reply_and_invoice" },
  ) => void;
  className?: string;
}) => (
  <div className={className ?? "flex flex-wrap items-center justify-end gap-2"}>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-9 shrink-0"
          aria-label="Internal note"
          onClick={() => onOpen("internal")}
        >
          <Lock className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Internal note</TooltipContent>
    </Tooltip>
    {canReplyAndCharge ? (
      <div className="inline-flex items-stretch rounded-md shadow-xs">
        <Button
          type="button"
          size="sm"
          className="h-9 rounded-r-none border-r border-primary-foreground/15 px-4"
          onClick={() => onOpen("reply")}
        >
          <Reply className="size-4" />
          Reply
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="sm"
              className="h-9 rounded-l-none px-2"
              aria-label="More reply options"
            >
              <ChevronDown className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem
              onClick={() =>
                onOpen("reply", { replyIntent: "reply_and_invoice" })
              }
            >
              <Send className="size-4" />
              Reply & Invoice
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    ) : (
      <Button
        type="button"
        size="sm"
        className="h-9 rounded-md px-4"
        onClick={() => onOpen("reply")}
      >
        <Reply className="size-4" />
        Reply
      </Button>
    )}
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-9 rounded-md px-4"
      onClick={() => onOpen("forward")}
    >
      <Forward className="size-4" />
      Forward
    </Button>
  </div>
);
