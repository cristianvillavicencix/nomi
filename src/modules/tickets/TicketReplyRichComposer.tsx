import {
  useLayoutEffect,
  useRef,
  type ClipboardEvent,
  type RefObject,
} from "react";
import { useAutoGrowTextarea } from "@/hooks/use-auto-grow-textarea";
import { cn } from "@/lib/utils";
import {
  sanitizeComposerHtml,
  hasReplyContentHtml,
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
  const localRef = useRef<HTMLDivElement | null>(null);

  const setRef = (node: HTMLDivElement | null) => {
    localRef.current = node;
    if (editorRef) {
      (editorRef as React.MutableRefObject<HTMLDivElement | null>).current =
        node;
    }
  };

  useLayoutEffect(() => {
    const el = localRef.current;
    if (!el || document.activeElement === el) return;
    const sanitized = sanitizeComposerHtml(value);
    if (el.innerHTML !== sanitized) {
      el.innerHTML = sanitized;
    }
  }, [value]);

  useAutoGrowTextarea(localRef, value, { minHeight, maxHeight, resizeTrigger });

  return (
    <div className="relative">
      {!hasReplyContentHtml(value) ? (
        <p className="pointer-events-none absolute left-5 top-3.5 text-sm text-muted-foreground">
          {placeholder}
        </p>
      ) : null}
      <div
        ref={setRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={() => {
          const html = sanitizeComposerHtml(localRef.current?.innerHTML ?? "");
          onChange(html);
        }}
        onPaste={onPaste}
        className={cn(
          "ticket-reply-rich-editor min-h-[12.5rem] overflow-hidden rounded-none border-0 px-5 py-3.5 text-sm leading-relaxed shadow-none outline-none focus-visible:ring-0",
          "[&_a]:text-primary [&_a]:underline [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-0 [&_p+p]:mt-3 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
          disabled && "cursor-not-allowed opacity-60",
          className,
        )}
      />
    </div>
  );
};
