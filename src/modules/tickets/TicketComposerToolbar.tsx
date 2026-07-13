import {
  Bold,
  ExternalLink,
  Italic,
  Link2,
  List,
  ListOrdered,
  Paperclip,
} from "lucide-react";
import type { Company, Contact } from "@/components/atomic-crm/types";
import type { Ticket, TicketInbox } from "@/modules/types";
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
  inbox?: TicketInbox | null;
  contact?: Contact | null;
  company?: Company | null;
  onInsertTemplate: (text: string) => void;
  onAttachClick: () => void;
  attachLabel?: string;
  showLargeFileTransfer?: boolean;
  onLargeFileTransferClick?: () => void;
};

export const TicketComposerToolbar = ({
  editorRef,
  onEditorChange,
  disabled = false,
  ticket,
  inbox,
  contact,
  company,
  onInsertTemplate,
  onAttachClick,
  attachLabel = "Attach files",
  showLargeFileTransfer = true,
  onLargeFileTransferClick,
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

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/10 px-2 py-1.5">
      {toolButton("Bold", <Bold className="size-4" />, () =>
        runCommand("bold"),
      )}
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

      {toolButton(attachLabel, <Paperclip className="size-4" />, onAttachClick)}
      {showLargeFileTransfer && onLargeFileTransferClick
        ? toolButton(
            "Large file via transfer.it",
            <ExternalLink className="size-4" />,
            onLargeFileTransferClick,
          )
        : null}
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
        inbox={inbox}
        contact={contact}
        company={company}
        disabled={disabled}
        onInsert={onInsertTemplate}
      />
    </div>
  );
};
