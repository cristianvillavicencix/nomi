const USD_AMOUNT_PATTERN = /\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\$\d+(?:\.\d{2})?/g;
const INVOICE_NUMBER_PATTERN = /\bINV-\d{4}-\d+\b/gi;
const PAYMENT_URL_PATTERN =
  /https?:\/\/[^\s]*\/iv\/[^\s?]+(?:\?[^\s]*)?|(?:^|\s)\/iv\/[^\s]+/gi;
const PAY_LINE_PATTERN = /^Pay:\s*.+$/gim;
const PAY_HERE_PATTERN = /\bPay here\s+https?:\/\/[^\s]+/gi;

export const FINANCIAL_DETAILS_HIDDEN_HINT =
  "Financial details hidden for your role";

const PAYMENT_LINK_HIDDEN = "[payment link hidden]";

export function sanitizeMessageBodyForFinancialAccess(
  body: string,
  canViewAmounts: boolean,
): string {
  if (canViewAmounts || !body) return body;

  return body
    .replace(PAY_LINE_PATTERN, "Pay: [hidden]")
    .replace(PAY_HERE_PATTERN, "Pay here [payment link hidden]")
    .replace(PAYMENT_URL_PATTERN, (match) => {
      const trimmed = match.trimStart();
      if (trimmed.startsWith("/")) return ` ${PAYMENT_LINK_HIDDEN}`;
      return PAYMENT_LINK_HIDDEN;
    })
    .replace(INVOICE_NUMBER_PATTERN, "—")
    .replace(USD_AMOUNT_PATTERN, "—");
}

export function messageBodyHasHiddenFinancialDetails(
  body: string,
  canViewAmounts: boolean,
): boolean {
  if (canViewAmounts || !body) return false;
  return sanitizeMessageBodyForFinancialAccess(body, false) !== body;
}
