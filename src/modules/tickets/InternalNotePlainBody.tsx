import type { ReactNode } from "react";

/**
 * Render plain internal-note text with light markdown: **bold** only.
 * Avoids dumping raw asterisks in the ticket thread.
 */
export const InternalNotePlainBody = ({
  text,
  className = "whitespace-pre-wrap text-sm leading-relaxed text-foreground",
}: {
  text: string;
  className?: string;
}) => {
  const nodes = renderInlineBold(text);
  return <div className={className}>{nodes}</div>;
};

const renderInlineBold = (text: string): ReactNode[] => {
  const nodes: ReactNode[] = [];
  const pattern = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    nodes.push(
      <strong key={`b-${key++}`} className="font-semibold">
        {match[1]}
      </strong>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
};

/** Collapse **bold** markers for one-line previews. */
export const stripInternalNoteMarkdown = (text: string) =>
  text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\s+/g, " ").trim();
