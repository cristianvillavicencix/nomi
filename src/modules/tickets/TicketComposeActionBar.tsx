import {
  ChevronDown,
  Forward,
  Lock,
  MessageSquare,
  Reply,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-9 gap-1.5 text-muted-foreground hover:text-foreground"
      onClick={() => onOpen("internal")}
    >
      <Lock className="size-4" />
      <span className="hidden sm:inline">Internal</span>
    </Button>

    <div className="inline-flex items-stretch rounded-md shadow-xs">
      <Button
        type="button"
        size="sm"
        className="h-9 rounded-r-none border-r border-primary-foreground/15 px-3"
        onClick={() => onOpen("reply")}
      >
        <Reply className="size-4" />
        <span className="hidden sm:inline">Reply</span>
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
          <DropdownMenuItem onClick={() => onOpen("reply")}>
            <MessageSquare className="size-4" />
            Reply only
          </DropdownMenuItem>
          {canReplyAndCharge ? (
            <DropdownMenuItem
              onClick={() =>
                onOpen("reply", { replyIntent: "reply_and_invoice" })
              }
            >
              <Send className="size-4" />
              Reply & Invoice
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-9 gap-1.5"
      onClick={() => onOpen("forward")}
    >
      <Forward className="size-4" />
      <span className="hidden sm:inline">Forward</span>
    </Button>
  </div>
);
