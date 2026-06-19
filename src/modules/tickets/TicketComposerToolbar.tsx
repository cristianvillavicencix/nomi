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
import type { Company, Contact } from "@/components/atomic-crm/types";
import type { Ticket } from "@/modules/types";
import { TicketReplyTemplatePicker } from "@/modules/tickets/TicketReplyTemplatePicker";
import { TicketReplyVariablePicker } from "@/modules/tickets/TicketReplyVariablePicker";
import {
  execRichEditorCommand,
  insertRichEditorLink,
  insertRichEditorText,
  sanitizeComposerHtml,
} from "@/modules/tickets/ticketReplyRichText";
import { Button } from "@/components/ui/button";

type TicketComposerToolbarProps = {
  editorRef: React.RefObject<HTMLDivElement | null>;
  onEditorChange: (html: string) => void;
  disabled?: boolean;
  ticket: Ticket;
  contact?: Contact | null;
  company?: Company | null;
  onInsertTemplate: (text: string) => void;
  onAttachClick: () => void;
  onSendInternal: () => void;
  onSendReply: () => void;
  canSend: boolean;
  submittingAs: "reply" | "internal" | null;
};

export const TicketComposerToolbar = ({
  editorRef,
  onEditorChange,
  disabled = false,
  ticket,
  contact,
  company,
  onInsertTemplate,
  onAttachClick,
  onSendInternal,
  onSendReply,
  canSend,
  submittingAs,
}: TicketComposerToolbarProps) => {
  const syncEditor = () => {
    const html = sanitizeComposerHtml(editorRef.current?.innerHTML ?? "");
    onEditorChange(html);
  };

  const runCommand = (command: string, value?: string) => {
    execRichEditorCommand(editorRef.current, command, value);
    syncEditor();
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
        {toolButton("Bold", <Bold className="size-4" />, () => runCommand("bold"))}
        {toolButton("Italic", <Italic className="size-4" />, () =>
          runCommand("italic"),
        )}
        {toolButton("Insert link", <Link2 className="size-4" />, () => {
          insertRichEditorLink(editorRef.current);
          syncEditor();
        })}
        {toolButton("Bullet list", <List className="size-4" />, () =>
          runCommand("insertUnorderedList"),
        )}
        {toolButton("Numbered list", <ListOrdered className="size-4" />, () =>
          runCommand("insertOrderedList"),
        )}

        <div className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden />

        {toolButton("Attach files", <Paperclip className="size-4" />, onAttachClick)}
        <TicketReplyVariablePicker
          ticket={ticket}
          contact={contact}
          company={company}
          disabled={disabled}
          onInsert={(token) => {
            insertRichEditorText(editorRef.current, token);
            syncEditor();
          }}
        />
        <TicketReplyTemplatePicker
          ticket={ticket}
          contact={contact}
          company={company}
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
