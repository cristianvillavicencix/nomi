import {
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Lock,
  Paperclip,
  Send,
} from "lucide-react";
import type { Ticket } from "@/modules/types";
import { TicketReplyTemplatePicker } from "@/modules/tickets/TicketReplyTemplatePicker";
import {
  applyTextareaLinePrefix,
  applyTextareaLink,
  applyTextareaWrap,
} from "@/modules/tickets/ticketComposerFormatting";
import { Button } from "@/components/ui/button";

type TicketComposerToolbarProps = {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  ticket: Ticket;
  onInsertTemplate: (text: string) => void;
  onAttachClick: () => void;
  onSendInternal: () => void;
  onSendReply: () => void;
  canSend: boolean;
  submittingAs: "reply" | "internal" | null;
};

export const TicketComposerToolbar = ({
  textareaRef,
  value,
  onChange,
  disabled = false,
  ticket,
  onInsertTemplate,
  onAttachClick,
  onSendInternal,
  onSendReply,
  canSend,
  submittingAs,
}: TicketComposerToolbarProps) => {
  const apply = (
    transform: (
      current: string,
      start: number,
      end: number,
    ) => { next: string; selectionStart: number; selectionEnd: number },
  ) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const { next, selectionStart, selectionEnd } = transform(value, start, end);
    onChange(next);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(selectionStart, selectionEnd);
    });
  };

  const toolButton = (
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
  ) => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-8 text-muted-foreground"
      disabled={disabled}
      title={label}
      aria-label={label}
      onClick={onClick}
    >
      {icon}
    </Button>
  );

  const isPending = submittingAs != null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/15 px-2 py-1.5">
      <div className="flex flex-wrap items-center gap-0.5">
        {toolButton("Bold", <Bold className="size-4" />, () =>
          apply((current, start, end) =>
            applyTextareaWrap(current, start, end, "**", "**"),
          ),
        )}
        {toolButton("Italic", <Italic className="size-4" />, () =>
          apply((current, start, end) =>
            applyTextareaWrap(current, start, end, "_", "_"),
          ),
        )}
        {toolButton("Insert link", <Link2 className="size-4" />, () =>
          apply((current, start, end) => applyTextareaLink(current, start, end)),
        )}
        {toolButton("Bullet list", <List className="size-4" />, () =>
          apply((current, start, end) =>
            applyTextareaLinePrefix(current, start, end, "- "),
          ),
        )}
        {toolButton("Numbered list", <ListOrdered className="size-4" />, () =>
          apply((current, start, end) =>
            applyTextareaLinePrefix(current, start, end, "1. "),
          ),
        )}

        <div className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden />

        {toolButton("Attach files", <Paperclip className="size-4" />, onAttachClick)}
        <TicketReplyTemplatePicker
          ticket={ticket}
          disabled={disabled}
          onInsert={onInsertTemplate}
        />
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || !canSend}
          className="h-8 rounded-md px-3"
          onClick={onSendInternal}
        >
          {isPending && submittingAs === "internal" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Lock className="size-4" />
          )}
          Internal note
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={disabled || !canSend}
          className="h-8 rounded-md px-3"
          onClick={onSendReply}
        >
          {isPending && submittingAs === "reply" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          Send reply
        </Button>
      </div>
    </div>
  );
};
