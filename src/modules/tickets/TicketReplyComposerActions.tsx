import { ChevronDown, Loader2, Send } from "lucide-react";
import type { TicketWorkflowStatus } from "@/modules/tickets/ticketStatusWorkflow";
import {
  ticketReplyStatusDotClass,
  type TicketReplyStatusAction,
} from "@/modules/tickets/ticketReplyStatusActions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type TicketReplyComposerActionsProps = {
  composeMode: "reply" | "forward";
  actions: TicketReplyStatusAction[];
  disabled?: boolean;
  hasContent: boolean;
  submittingAs: "internal" | "forward" | TicketWorkflowStatus | null;
  onCancel: () => void;
  onSendReply: (nextStatus: TicketWorkflowStatus) => void;
  onSendForward: () => void;
};

export const TicketReplyComposerActions = ({
  composeMode,
  actions,
  disabled = false,
  hasContent,
  submittingAs,
  onCancel,
  onSendReply,
  onSendForward,
}: TicketReplyComposerActionsProps) => {
  const primaryAction =
    actions.find((action) => action.primary) ?? actions[0] ?? null;
  const alternateActions = actions.filter(
    (action) => action.status !== primaryAction?.status,
  );
  const sendDisabled = disabled || !hasContent;
  const isReplySubmitting =
    submittingAs != null &&
    submittingAs !== "internal" &&
    submittingAs !== "forward";

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t bg-muted/15 px-4 py-2.5 md:px-5">
      {composeMode === "forward" ? (
        <Button
          type="button"
          size="sm"
          disabled={sendDisabled}
          className="h-9 gap-2"
          onClick={onSendForward}
        >
          {submittingAs === "forward" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          Send forward
        </Button>
      ) : primaryAction ? (
        <div className="inline-flex items-stretch rounded-md shadow-xs">
          <Button
            type="button"
            size="sm"
            disabled={sendDisabled}
            className="h-9 rounded-r-none border-r border-primary-foreground/15 pr-3 pl-3"
            onClick={() => onSendReply(primaryAction.status)}
          >
            {isReplySubmitting && submittingAs === primaryAction.status ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            {primaryAction.label}
          </Button>

          {alternateActions.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  disabled={sendDisabled}
                  className="h-9 rounded-l-none px-2"
                  aria-label="More send options"
                >
                  <ChevronDown className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  onClick={() => onSendReply(primaryAction.status)}
                >
                  <Send className="size-4" />
                  {primaryAction.label}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  Send and update status
                </DropdownMenuLabel>
                {alternateActions.map((action) => (
                  <DropdownMenuItem
                    key={action.status}
                    onClick={() => onSendReply(action.status)}
                  >
                    <span
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        ticketReplyStatusDotClass(action.status),
                      )}
                      aria-hidden
                    />
                    {action.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      ) : null}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9"
        disabled={disabled}
        onClick={onCancel}
      >
        Cancel
      </Button>
    </div>
  );
};
