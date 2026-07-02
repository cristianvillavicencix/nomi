export {
  splitHtmlEmail,
  splitPlainTextEmail,
  stripComposerQuotedHtml,
  stripComposerQuotedPlainText,
  stripQuotedHtml,
  stripQuotedPlainText,
  prepareQuotedHtmlForDisplay,
  prepareQuotedPlainForDisplay,
  hasSubstantialQuotedContent,
  hasRichHtmlStructure,
  isPlainTextSimilar,
  type SplitEmailContent,
} from "../../../supabase/functions/_shared/ticketEmailQuotedContent.ts";
