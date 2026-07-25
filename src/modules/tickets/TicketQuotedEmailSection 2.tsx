import { useMemo, useState } from "react";
import { sanitizeTicketEmailHtmlOriginal } from "@/modules/tickets/sanitizeTicketEmailHtml";
import {
  dedupeQuotedHtmlForDisplay,
  dedupeQuotedPlainForDisplay,
} from "@/modules/tickets/dedupeQuotedEmailDisplay";
import {
  hasSubstantialQuotedContent,
  prepareQuotedHtmlForDisplay,
  prepareQuotedPlainForDisplay,
} from "@/modules/tickets/ticketEmailQuotedContent";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const TicketQuotedEmailSection = ({
  quoted,
  quoteHeader,
  isHtml = false,
  className,
}: {
  quoted: string;
  quoteHeader?: string | null;
  isHtml?: boolean;
  className?: string;
}) => {
  const [expanded, setExpanded] = useState(false);
  const displayQuoted = useMemo(() => {
    if (isHtml) {
      const prepared = prepareQuotedHtmlForDisplay(quoted, quoteHeader);
      const deduped = dedupeQuotedHtmlForDisplay(prepared);
      return { html: deduped, plain: null };
    }

    const plain = dedupeQuotedPlainForDisplay(
      prepareQuotedPlainForDisplay(quoted, quoteHeader),
    );
    return { html: null, plain };
  }, [isHtml, quoted, quoteHeader]);

  const displayContent = displayQuoted.html ?? displayQuoted.plain ?? "";

  if (!hasSubstantialQuotedContent(displayContent)) return null;

  return (
    <div className={cn("mt-2", className)}>
      {!expanded ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto gap-1 px-1 py-0.5 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded(true)}
          aria-label="Show quoted email"
        >
          <span className="font-medium tracking-widest">···</span>
          Show quoted text
        </Button>
      ) : (
        <div className="space-y-1.5">
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto px-0 text-xs text-muted-foreground"
            onClick={() => setExpanded(false)}
          >
            Hide quoted text
          </Button>
          {quoteHeader ? (
            <p className="text-[11px] leading-snug text-muted-foreground">
              {quoteHeader}
            </p>
          ) : null}
          {displayQuoted.html ? (
            <div
              className={cn(
                "ticket-email-html border-l-2 border-border/80 pl-3 text-sm leading-relaxed text-muted-foreground",
                "[&_a]:text-blue-700 [&_a]:underline",
                "[&_img]:my-2 [&_img]:block [&_img]:!h-auto [&_img]:!max-w-full [&_img]:!max-h-[420px] [&_img]:!object-contain",
                "[&_table]:my-2 [&_table]:max-w-full",
                "[&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
              )}
              dangerouslySetInnerHTML={{
                __html: sanitizeTicketEmailHtmlOriginal(displayQuoted.html),
              }}
            />
          ) : (
            <pre className="whitespace-pre-wrap border-l-2 border-border/80 pl-3 font-sans text-sm leading-relaxed text-muted-foreground">
              {displayQuoted.plain}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};
