import DOMPurify from "dompurify";
import { Marked, type TokenizerExtension } from "marked";
import { cn } from "@/lib/utils";

/** Autolink bare URLs (same behavior as shared Markdown). */
const urlExtension: TokenizerExtension = {
  name: "autolink",
  level: "inline",
  start(src) {
    const match = src.match(/https?:\/\//);
    if (!match) return;
    const beforeMatch = src.slice(0, match.index);
    if (beforeMatch.endsWith("](") || beforeMatch.endsWith("(")) {
      return;
    }
    return match.index;
  },
  tokenizer(src) {
    const match = src.match(/^https?:\/\/[^\s<>)[\]]+/);
    if (match) {
      return {
        type: "link",
        raw: match[0],
        href: match[0],
        text: match[0],
        tokens: [{ type: "text", raw: match[0], text: match[0] }],
      };
    }
  },
};

/**
 * Contract-only parser: breaks:false so single newlines do not become <br>.
 * (Shared Markdown keeps breaks:true for email/notes.)
 */
const contractMarked = new Marked();
contractMarked.use({
  extensions: [urlExtension],
  breaks: false,
  gfm: true,
  hooks: {
    postprocess: (html) => DOMPurify.sanitize(html),
  },
});

/** Renders contract/agreement markdown as a print-like legal document. */
export function ContractDocumentMarkdown({
  children,
  className,
  /** Wrap in an A4 sheet (gray stage + white page margins). */
  page = false,
}: {
  children: string;
  className?: string;
  page?: boolean;
}) {
  const html = contractMarked.parse(children) as string;

  const body = (
    <div
      className={cn("contract-document", !page && className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );

  if (!page) return body;

  return (
    <div className={cn("contract-document-stage", className)}>
      <article className="contract-document-page">{body}</article>
    </div>
  );
}
