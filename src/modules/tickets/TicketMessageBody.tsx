import { useState } from "react";
import { Markdown } from "@/components/atomic-crm/misc/Markdown";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  sanitizeTicketEmailHtml,
  sanitizeTicketEmailHtmlOriginal,
} from "@/modules/tickets/sanitizeTicketEmailHtml";

export const TicketMessageBody = ({
  body,
  htmlBody,
  stripHrefs,
  attachmentSrcs,
  attachmentTitles,
}: {
  body?: string | null;
  htmlBody?: string | null;
  /** Hrefs removed from HTML because they render in the attachments panel. */
  stripHrefs?: string[];
  attachmentSrcs?: string[];
  attachmentTitles?: string[];
}) => {
  const [viewOriginal, setViewOriginal] = useState(false);
  const html = htmlBody?.trim();

  if (html) {
    const sanitized = viewOriginal
      ? sanitizeTicketEmailHtmlOriginal(html)
      : sanitizeTicketEmailHtml(html, {
          stripHrefs,
          attachmentSrcs,
          attachmentTitles,
        });

    return (
      <div className="space-y-2">
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => setViewOriginal((current) => !current)}
          >
            {viewOriginal ? "Safe view" : "Original email"}
          </Button>
        </div>
        <div
          className={cn(
            "ticket-email-html isolate overflow-x-auto leading-relaxed break-words text-foreground",
            "rounded-md dark:bg-card/50 dark:p-3 dark:ring-1 dark:ring-border/60",
            "[&_a]:font-medium [&_a]:text-primary [&_a]:underline",
            "[&_img]:my-2 [&_img]:block [&_img]:h-auto [&_img]:max-w-full",
            "[&_table]:my-2 [&_table]:max-w-full [&_table]:table-fixed",
            "[&_td]:break-words [&_th]:break-words [&_td]:text-foreground [&_th]:text-foreground",
            "[&_*]:!float-none [&_*]:!clear-both [&_*]:max-w-full",
            "[&_p]:my-2 [&_p]:text-foreground [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
            "[&_div]:relative [&_span]:relative [&_span]:text-inherit",
            "[&_font]:text-inherit",
          )}
          dangerouslySetInnerHTML={{ __html: sanitized }}
        />
      </div>
    );
  }

  if (body?.trim()) {
    return <Markdown className="leading-relaxed">{body}</Markdown>;
  }

  return <p className="text-muted-foreground">(Empty message)</p>;
};
