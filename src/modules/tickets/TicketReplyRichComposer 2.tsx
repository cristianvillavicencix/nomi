import {
  useLayoutEffect,
  useRef,
  type ClipboardEvent,
  type RefObject,
} from "react";
import { useAutoGrowTextarea } from "@/hooks/use-auto-grow-textarea";
import { cn } from "@/lib/utils";
import {
  assembleReplyComposerHtml,
  extractReplyComposerParts,
  sanitizeComposerHtml,
  shouldShowComposerPlaceholder,
} from "@/modules/tickets/ticketReplyRichText";

type TicketReplyRichComposerProps = {
  editorRef: RefObject<HTMLDivElement | null>;
  value: string;
  onChange: (html: string) => void;
  onPaste?: (event: ClipboardEvent<HTMLDivElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  minHeight?: number;
  maxHeight?: number;
  resizeTrigger?: unknown;
  className?: string;
};

export const TicketReplyRichComposer = ({
  editorRef,
  value,
  onChange,
  onPaste,
  placeholder = "Write your reply...",
  disabled = false,
  minHeight = 200,
  maxHeight = 720,
  resizeTrigger,
  className,
}: TicketReplyRichComposerProps) => {
  const userEditorRef = useRef<HTMLDivElement | null>(null);
  const { userNoteHtml, signatureHtml, quotedReplyHtml } =
    extractReplyComposerParts(value);
  const editableHtml = `${userNoteHtml}${signatureHtml}`;

  const setUserEditorRef = (node: HTMLDivElement | null) => {
    userEditorRef.current = node;
    if (editorRef) {
      (editorRef as React.MutableRefObject<HTMLDivElement | null>).current =
        node;
    }
  };

  useLayoutEffect(() => {
    const el = userEditorRef.current;
    if (!el || document.activeElement === el) return;
    const sanitized = sanitizeComposerHtml(editableHtml || "<p><br></p>");
    if (el.innerHTML !== sanitized) {
      el.innerHTML = sanitized;
    }
  }, [editableHtml]);

  useAutoGrowTextarea(userEditorRef, editableHtml, {
    minHeight: Math.min(minHeight, 160),
    maxHeight: Math.min(maxHeight, 280),
    resizeTrigger,
  });

  const updateEditableHtml = (nextEditableHtml: string) => {
    const sanitized = sanitizeComposerHtml(nextEditableHtml);
    const parts = extractReplyComposerParts(sanitized);
    onChange(
      assembleReplyComposerHtml({
        userNoteHtml: parts.userNoteHtml || "<p><br></p>",
        signatureHtml: parts.signatureHtml,
        quotedReplyHtml,
      }),
    );
  };

  const showPlaceholder = shouldShowComposerPlaceholder(value);

  return (
    <div className="px-5 py-3.5">
      <div className="relative">
        {showPlaceholder ? (
          <p className="pointer-events-none absolute left-0 top-0 text-sm text-muted-foreground">
            {placeholder}
          </p>
        ) : null}
        <div
          ref={setUserEditorRef}
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={() => {
            updateEditableHtml(userEditorRef.current?.innerHTML ?? "");
          }}
          onPaste={onPaste}
          className={cn(
            "ticket-reply-rich-editor min-h-[5.5rem] overflow-hidden rounded-none border-0 p-0 text-sm leading-relaxed shadow-none outline-none focus-visible:ring-0",
            "[&_a]:text-primary [&_a]:underline [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-0 [&_p+p]:mt-3 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
            "[&_[data-ticket-reply-signature]]:text-[13px] [&_[data-ticket-reply-signature]]:leading-relaxed [&_[data-ticket-reply-signature]_p]:my-0",
            disabled && "cursor-not-allowed opacity-60",
            className,
          )}
        />
      </div>

      {quotedReplyHtml ? (
        <div
          className="ticket-reply-rich-meta mt-4 text-[13px] leading-relaxed text-muted-foreground [&_.ticket-reply-quoted-body]:text-foreground [&_a]:text-primary [&_a]:underline [&_p]:my-1.5 [&_p:first-child]:mt-0 [&_table]:my-2"
          contentEditable={false}
          suppressContentEditableWarning
          dangerouslySetInnerHTML={{ __html: quotedReplyHtml }}
        />
      ) : null}
    </div>
  );
};
