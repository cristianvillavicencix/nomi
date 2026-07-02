import { cn } from "@/lib/utils";
import { stripTrailingDuplicateOfQuoted } from "@/modules/tickets/dedupeQuotedEmailDisplay";
import { sanitizeTicketEmailHtml } from "@/modules/tickets/sanitizeTicketEmailHtml";
import { TicketQuotedEmailSection } from "@/modules/tickets/TicketQuotedEmailSection";
import {
  hasRichHtmlStructure,
  hasSubstantialQuotedContent,
  isPlainTextSimilar,
  splitHtmlEmail,
  splitPlainTextEmail,
} from "@/modules/tickets/ticketEmailQuotedContent";
import { htmlToPlainText } from "@/modules/tickets/ticketReplyRichText";

const emailHtmlClassName = cn(
  "ticket-email-html leading-relaxed break-words text-sm text-foreground",
  "[&_a]:font-medium [&_a]:text-blue-700 [&_a]:underline",
  "[&_img]:my-2 [&_img]:block [&_img]:h-auto [&_img]:max-w-full",
  "[&_table]:my-2 [&_table]:max-w-full [&_table]:table-fixed",
  "[&_td]:break-words [&_th]:break-words",
  "[&_*]:!float-none [&_*]:!clear-both [&_*]:max-w-full",
  "[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
  "[&_div]:relative [&_span]:relative",
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
}: {
  html: string;
  stripHrefs?: string[];
  attachmentSrcs?: string[];
  attachmentTitles?: string[];
}) => (
  <div
    className={emailHtmlClassName}
    dangerouslySetInnerHTML={{
      __html: sanitizeTicketEmailHtml(html, {
        stripHrefs,
        attachmentSrcs,
        attachmentTitles,
      }),
    }}
  />
);

export const TicketMessageBody = ({
  body,
  htmlBody,
  stripHrefs,
  attachmentSrcs,
  attachmentTitles,
}: {
  body?: string | null;
  htmlBody?: string | null;
  stripHrefs?: string[];
  attachmentSrcs?: string[];
  attachmentTitles?: string[];
}) => {
  const html = htmlBody?.trim();
  const plain = body?.trim();

  if (html) {
    const split = splitHtmlEmail(html);
    const hasQuoted =
      Boolean(split.quoted) && hasSubstantialQuotedContent(split.quoted);
    const htmlMainText = htmlToPlainText(split.content || html);

    // Plain body is already stripped on ingest; HTML may still include the quoted thread.
    const usePlainAsMain =
      Boolean(plain) &&
      hasQuoted &&
      isPlainTextSimilar(plain, htmlMainText);

    if (usePlainAsMain && plain) {
      const mainPlain = splitPlainTextEmail(plain).content || plain;
      return (
        <div className="space-y-1">
          <PlainTicketText text={mainPlain} />
          <TicketQuotedEmailSection
            quoted={split.quoted!}
            quoteHeader={split.quoteHeader}
            isHtml
          />
        </div>
      );
    }

    if (plain && !hasQuoted && !hasRichHtmlStructure(html)) {
      if (isPlainTextSimilar(plain, htmlMainText)) {
        return (
          <div className="space-y-1">
            <PlainTicketText text={plain} />
          </div>
        );
      }
    }

    const displayHtml = hasQuoted
      ? stripTrailingDuplicateOfQuoted(
          split.content || html,
          split.quoted!,
          true,
        )
      : split.content || html;
    return (
      <div className="space-y-1">
        <HtmlTicketBody
          html={displayHtml}
          stripHrefs={stripHrefs}
          attachmentSrcs={attachmentSrcs}
          attachmentTitles={attachmentTitles}
        />
        {hasQuoted ? (
          <TicketQuotedEmailSection
            quoted={split.quoted!}
            quoteHeader={split.quoteHeader}
            isHtml
          />
        ) : null}
      </div>
    );
  }

  if (plain) {
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
