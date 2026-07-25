import { ChevronDown, FileText, Loader2, Send } from "lucide-react";
import type { TicketWorkflowStatus } from "@/modules/tickets/ticketStatusWorkflow";
import {
  ticketReplyStatusDotClass,
  type TicketReplyStatusTransition,
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

export type TicketReplySubmittingAs =
  | "internal"
  | "forward"
  | "charge"
  | TicketWorkflowStatus
  | null;

type TicketReplyComposerActionsProps = {
  composeMode: "reply" | "forward";
  currentStatus: TicketWorkflowStatus;
  statusTransitions: TicketReplyStatusTransition[];
  disabled?: boolean;
  hasContent: boolean;
  submittingAs: TicketReplySubmittingAs;
  showReplyAndCharge?: boolean;
  /** Invoice deliverables mode — primary action creates invoice, not a plain reply. */
  invoiceComposerMode?: boolean;
  canCreateInvoice?: boolean;
  /** When true, primary button becomes Reply & Invoice (chosen before composing). */
  preferReplyAndCharge?: boolean;
  className?: string;
  onCancel: () => void;
  onSendReply: (nextStatus: TicketWorkflowStatus) => void;
  onCreateInvoice?: () => void;
  /** Enter invoice reply mode (upload deliverables) without sending yet. */
  onStartReplyAndInvoice?: () => void;
  onSendForward: () => void;
};

export const TicketReplyComposerActions = ({
  composeMode,
  currentStatus,
  statusTransitions,
  disabled = false,
  hasContent,
  submittingAs,
  showReplyAndCharge = false,
  invoiceComposerMode = false,
  canCreateInvoice = false,
  preferReplyAndCharge = false,
  className,
  onCancel,
  onSendReply,
  onCreateInvoice,
  onStartReplyAndInvoice,
  onSendForward,
}: TicketReplyComposerActionsProps) => {
  const sendDisabled = disabled || (!invoiceComposerMode && !hasContent);
  const isReplySubmitting =
    submittingAs != null &&
    submittingAs !== "internal" &&
    submittingAs !== "forward" &&
    submittingAs !== "charge";
  const isChargeSubmitting = submittingAs === "charge";
  const replyAndChargeEnabled =
    showReplyAndCharge && typeof onStartReplyAndInvoice === "function";
  const primaryIsInvoice = invoiceComposerMode && preferReplyAndCharge;
  const showStatusMenu =
    !primaryIsInvoice &&
    (statusTransitions.length > 0 || replyAndChargeEnabled);

  const primaryDisabled = primaryIsInvoice
    ? disabled || !canCreateInvoice || isChargeSubmitting
    : sendDisabled || isChargeSubmitting;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-end gap-2 border-t bg-background px-4 py-2.5 md:px-5",
        className,
      )}
    >
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
      ) : (
        <div className="inline-flex items-stretch rounded-md shadow-xs">
          <Button
            type="button"
            size="sm"
            disabled={primaryDisabled}
            className={cn(
              "h-9 pr-3 pl-3",
              showStatusMenu &&
                "rounded-r-none border-r border-primary-foreground/15",
            )}
            onClick={() => {
              if (primaryIsInvoice) {
                onCreateInvoice?.();
                return;
              }
              onSendReply(currentStatus);
            }}
          >
            {primaryIsInvoice ? (
              isChargeSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileText className="size-4" />
              )
            ) : isReplySubmitting && submittingAs === currentStatus ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            {primaryIsInvoice
              ? "Create invoice & request payment"
              : "Reply"}
          </Button>

          {showStatusMenu ? (
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
                {statusTransitions.length > 0 ? (
                  <>
                    <DropdownMenuLabel className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      Send and update status
                    </DropdownMenuLabel>
                    {statusTransitions.map((transition) => (
                      <DropdownMenuItem
                        key={transition.status}
                        onClick={() => onSendReply(transition.status)}
                      >
                        <span
                          className={cn(
                            "size-2 shrink-0 rounded-full",
                            ticketReplyStatusDotClass(transition.status),
                          )}
                          aria-hidden
                        />
                        {transition.label}
                      </DropdownMenuItem>
                    ))}
                  </>
                ) : null}
                {replyAndChargeEnabled ? (
                  <>
                    {statusTransitions.length > 0 ? (
                      <DropdownMenuSeparator />
                    ) : null}
                    <DropdownMenuLabel className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      Billing
                    </DropdownMenuLabel>
                    <DropdownMenuItem onClick={onStartReplyAndInvoice}>
                      <FileText className="size-4" />
                      Reply & Invoice
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      )}

      <Button
        type="button"
        variant="secondary"
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
