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
            "ticket-email-html isolate overflow-x-auto leading-relaxed break-words",
            "rounded-md border border-border/60 bg-white p-3 text-neutral-900 shadow-sm",
            "dark:border-border/80 dark:bg-[#f4f4f5] dark:text-neutral-900 dark:shadow-none",
            "[&_a]:font-medium [&_a]:text-blue-700 [&_a]:underline dark:[&_a]:text-blue-800",
            "[&_img]:my-2 [&_img]:block [&_img]:h-auto [&_img]:max-w-full",
            "[&_table]:my-2 [&_table]:max-w-full [&_table]:table-fixed",
            "[&_td]:break-words [&_th]:break-words",
            "[&_*]:!float-none [&_*]:!clear-both [&_*]:max-w-full",
            "[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
            "[&_div]:relative [&_span]:relative",
            viewOriginal &&
              "[&_*]:text-inherit [&_p]:text-inherit [&_span]:text-inherit [&_font]:text-inherit",
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
