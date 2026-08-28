import {
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { MoreHorizontal } from "lucide-react";
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
  /** Collapse quoted thread behind … (Gmail-style). Default true. */
  collapseQuotedByDefault?: boolean;
  /** Shown above the quoted … so attachments read as part of the reply. */
  attachments?: ReactNode;
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
  collapseQuotedByDefault = true,
  attachments,
}: TicketReplyRichComposerProps) => {
  const userEditorRef = useRef<HTMLDivElement | null>(null);
  const { userNoteHtml, signatureHtml, quotedReplyHtml } =
    extractReplyComposerParts(value);
  // Signature stays outside the editable area so the write space stays empty.
  const noteHtml = userNoteHtml || "<p><br></p>";
  const [quoteExpanded, setQuoteExpanded] = useState(!collapseQuotedByDefault);

  useLayoutEffect(() => {
    setQuoteExpanded(!collapseQuotedByDefault);
  }, [quotedReplyHtml, collapseQuotedByDefault]);

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
    const sanitized = sanitizeComposerHtml(noteHtml);
    if (el.innerHTML !== sanitized) {
      el.innerHTML = sanitized;
    }
  }, [noteHtml]);

  useAutoGrowTextarea(userEditorRef, noteHtml, {
    minHeight,
    maxHeight,
    resizeTrigger,
  });

  const updateNoteHtml = (nextNoteHtml: string) => {
    const sanitized = sanitizeComposerHtml(nextNoteHtml);
    const parts = extractReplyComposerParts(sanitized);
    onChange(
      assembleReplyComposerHtml({
        userNoteHtml: parts.userNoteHtml || "<p><br></p>",
        signatureHtml,
        quotedReplyHtml,
      }),
    );
  };

  const showPlaceholder = shouldShowComposerPlaceholder(value);

  return (
    <div className="px-4 py-3 md:px-5">
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
            updateNoteHtml(userEditorRef.current?.innerHTML ?? "");
          }}
          onPaste={onPaste}
          className={cn(
            "ticket-reply-rich-editor min-h-[12rem] overflow-hidden rounded-none border-0 p-0 text-sm leading-relaxed shadow-none outline-none focus-visible:ring-0",
            "[&_a]:text-primary [&_a]:underline [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-0 [&_p+p]:mt-3 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
            disabled && "cursor-not-allowed opacity-60",
            className,
          )}
        />
      </div>

      {attachments ? (
        <div className="mt-3 flex flex-col gap-1.5">{attachments}</div>
      ) : null}

      {signatureHtml ? (
        <div
          className="pointer-events-none mt-6 select-none text-[13px] leading-relaxed text-muted-foreground [&_p]:my-0"
          contentEditable={false}
          suppressContentEditableWarning
          dangerouslySetInnerHTML={{ __html: signatureHtml }}
        />
      ) : null}

      {quotedReplyHtml ? (
        <div className="mt-4">
          {quoteExpanded ? (
            <div
              className="ticket-reply-rich-meta text-[13px] leading-relaxed text-muted-foreground [&_.ticket-reply-quoted-body]:text-foreground [&_a]:text-primary [&_a]:underline [&_p]:my-1.5 [&_p:first-child]:mt-0 [&_table]:my-2"
              contentEditable={false}
              suppressContentEditableWarning
              dangerouslySetInnerHTML={{ __html: quotedReplyHtml }}
            />
          ) : (
            <button
              type="button"
              className="inline-flex h-7 items-center gap-0.5 rounded-full px-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              aria-label="Show quoted message"
              title="Show quoted message"
              onClick={() => setQuoteExpanded(true)}
            >
              <MoreHorizontal className="size-4" />
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
};
