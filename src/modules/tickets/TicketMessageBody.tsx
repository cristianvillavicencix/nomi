import DOMPurify from "dompurify";
import { Markdown } from "@/components/atomic-crm/misc/Markdown";
import { cn } from "@/lib/utils";

let emailHtmlHookInstalled = false;

const sanitizeEmailHtml = (html: string) => {
  if (!emailHtmlHookInstalled) {
    DOMPurify.addHook("afterSanitizeAttributes", (node) => {
      if (node.tagName === "A") {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }
    });
    emailHtmlHookInstalled = true;
  }

  return DOMPurify.sanitize(html, {
    ADD_ATTR: ["target", "style", "bgcolor", "align", "valign", "width", "height"],
  });
};

export const TicketMessageBody = ({
  body,
  htmlBody,
}: {
  body?: string | null;
  htmlBody?: string | null;
}) => {
  const html = htmlBody?.trim();
  if (html) {
    return (
      <div
        className={cn(
          "ticket-email-html leading-relaxed",
          "[&_a]:font-medium [&_a]:text-primary [&_a]:underline",
          "[&_img]:max-w-full [&_table]:max-w-full",
          "[&_.button]:inline-block",
        )}
        dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(html) }}
      />
    );
  }

  if (body?.trim()) {
    return <Markdown className="leading-relaxed">{body}</Markdown>;
  }

  return <p className="text-muted-foreground">(Empty message)</p>;
};
