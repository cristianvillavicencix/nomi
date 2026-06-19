import { Markdown } from "@/components/atomic-crm/misc/Markdown";
import { cn } from "@/lib/utils";
import { sanitizeTicketEmailHtml } from "@/modules/tickets/sanitizeTicketEmailHtml";

export const TicketMessageBody = ({
  body,
  htmlBody,
  stripHrefs,
  attachmentSrcs,
  attachmentTitles,
}: {
  body?: string | null;
  htmlBody?: string | null;
  /** Hrefs shown in the attachments panel — stripped from inline HTML. */
  stripHrefs?: string[];
  attachmentSrcs?: string[];
  attachmentTitles?: string[];
}) => {
  const html = htmlBody?.trim();
  if (html) {
    return (
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
        dangerouslySetInnerHTML={{
          __html: sanitizeTicketEmailHtml(html, {
            stripHrefs,
            attachmentSrcs,
            attachmentTitles,
          }),
        }}
      />
    );
  }

  if (body?.trim()) {
    return <Markdown className="leading-relaxed">{body}</Markdown>;
  }

  return <p className="text-muted-foreground">(Empty message)</p>;
};
