import { cn } from "@/lib/utils";
import { stripTrailingDuplicateOfQuoted } from "@/modules/tickets/dedupeQuotedEmailDisplay";
import {
  sanitizeTicketEmailHtml,
  sanitizeTicketEmailHtmlOriginal,
} from "@/modules/tickets/sanitizeTicketEmailHtml";
import { TicketQuotedEmailSection } from "@/modules/tickets/TicketQuotedEmailSection";
import { resolveTicketHtmlDisplay } from "@/modules/tickets/resolveTicketHtmlDisplay";
import {
  hasSubstantialQuotedContent,
  isForwardedStyleEmail,
  isForwardedStylePlainEmail,
  isPlainTextSimilar,
  splitPlainTextEmail,
} from "@/modules/tickets/ticketEmailQuotedContent";
import { htmlToPlainText } from "@/modules/tickets/ticketReplyRichText";

/** Safe layout for our outbound HTML — flattens floats so CRM chrome stays clean. */
const emailHtmlClassNameSafe = cn(
  "ticket-email-html leading-relaxed break-words text-sm text-foreground",
  "[&_a]:font-medium [&_a]:text-blue-700 [&_a]:underline",
  "[&_img]:my-2 [&_img]:block [&_img]:!h-auto [&_img]:!max-w-full [&_img]:!max-h-[420px] [&_img]:!object-contain",
  "[&_table]:my-2 [&_table]:!max-w-full [&_table]:table-fixed",
  "[&_td]:break-words [&_th]:break-words",
  "[&_*]:!float-none [&_*]:!clear-both [&_*]:max-w-full",
  "[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
  "[&_div]:relative [&_span]:relative",
);

/** Closer to Gmail for inbound marketing/client HTML — keeps floats/tables. */
const emailHtmlClassNameOriginal = cn(
  "ticket-email-html overflow-x-auto leading-relaxed break-words text-sm text-foreground",
  "[&_a]:font-medium [&_a]:text-blue-700 [&_a]:underline",
  "[&_img]:block [&_img]:max-w-full",
  "[&_table]:!max-w-full",
  "[&_td]:break-words [&_th]:break-words",
  "[&_*]:max-w-full",
  "[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
);

const PlainTicketText = ({ text }: { text: string }) => (
  <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
    {text}
  </div>
);

const HtmlTicketBody = ({
  html,
  stripHrefs,
  attachmentSrcs,
  attachmentTitles,
  preserveOriginalLayout = false,
}: {
  html: string;
  stripHrefs?: string[];
  attachmentSrcs?: string[];
  attachmentTitles?: string[];
  preserveOriginalLayout?: boolean;
}) => {
  const sanitizeOptions = {
    stripHrefs,
    attachmentSrcs,
    attachmentTitles,
  };
  return (
    <div
      className={
        preserveOriginalLayout
          ? emailHtmlClassNameOriginal
          : emailHtmlClassNameSafe
      }
      dangerouslySetInnerHTML={{
        __html: preserveOriginalLayout
          ? sanitizeTicketEmailHtmlOriginal(html, sanitizeOptions)
          : sanitizeTicketEmailHtml(html, sanitizeOptions),
      }}
    />
  );
};

export const TicketMessageBody = ({
  body,
  htmlBody,
  stripHrefs,
  attachmentSrcs,
  attachmentTitles,
  emailVariant = "outbound",
}: {
  body?: string | null;
  htmlBody?: string | null;
  stripHrefs?: string[];
  attachmentSrcs?: string[];
  attachmentTitles?: string[];
  emailVariant?: "inbound" | "outbound";
}) => {
  const html = htmlBody?.trim();
  const plain = body?.trim();

  if (html) {
    const display = resolveTicketHtmlDisplay(html);

    if (display.mode === "full") {
      if (plain && isForwardedStylePlainEmail(plain)) {
        return <PlainTicketText text={plain} />;
      }

      return (
        <HtmlTicketBody
          html={display.html}
          stripHrefs={stripHrefs}
          attachmentSrcs={attachmentSrcs}
          attachmentTitles={attachmentTitles}
          preserveOriginalLayout={
            emailVariant === "inbound" || isForwardedStyleEmail(display.html)
          }
        />
      );
    }

    const htmlMainText = htmlToPlainText(display.content);
    const usePlainAsMain =
      Boolean(plain) && isPlainTextSimilar(plain, htmlMainText);

    if (usePlainAsMain && plain) {
      const mainPlain = splitPlainTextEmail(plain).content || plain;
      return (
        <div className="space-y-1">
          <PlainTicketText text={mainPlain} />
          <TicketQuotedEmailSection
            quoted={display.quoted}
            quoteHeader={display.quoteHeader}
            isHtml
          />
        </div>
      );
    }

    return (
      <div className="space-y-1">
        <HtmlTicketBody
          html={display.content}
          stripHrefs={stripHrefs}
          attachmentSrcs={attachmentSrcs}
          attachmentTitles={attachmentTitles}
          preserveOriginalLayout={emailVariant === "inbound"}
        />
        <TicketQuotedEmailSection
          quoted={display.quoted}
          quoteHeader={display.quoteHeader}
          isHtml
        />
      </div>
    );
  }

  if (plain) {
    if (emailVariant === "inbound" && isForwardedStylePlainEmail(plain)) {
      return <PlainTicketText text={plain} />;
    }

    const split = splitPlainTextEmail(plain);
    const displayContent =
      split.quoted && hasSubstantialQuotedContent(split.quoted)
        ? stripTrailingDuplicateOfQuoted(split.content, split.quoted, false)
        : split.content;
    return (
      <div className="space-y-1">
        <PlainTicketText text={displayContent} />
        {split.quoted && hasSubstantialQuotedContent(split.quoted) ? (
          <TicketQuotedEmailSection
            quoted={split.quoted}
            quoteHeader={split.quoteHeader}
          />
        ) : null}
      </div>
    );
  }

  return <p className="text-muted-foreground">(Empty message)</p>;
};
