import { Markdown } from "@/components/atomic-crm/misc/Markdown";
import { cn } from "@/lib/utils";

/** Renders contract/agreement markdown with document typography (green headings, check lists). */
export function ContractDocumentMarkdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <Markdown className={cn("contract-document", className)}>
      {children}
    </Markdown>
  );
}
