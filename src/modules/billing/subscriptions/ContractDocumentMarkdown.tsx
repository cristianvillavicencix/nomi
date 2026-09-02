import { Markdown } from "@/components/atomic-crm/misc/Markdown";
import { cn } from "@/lib/utils";

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
  const body = (
    <Markdown className={cn("contract-document", !page && className)}>
      {children}
    </Markdown>
  );

  if (!page) return body;

  return (
    <div className={cn("contract-document-stage", className)}>
      <article className="contract-document-page">{body}</article>
    </div>
  );
}
