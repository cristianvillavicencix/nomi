/**
 * Wrap composer HTML in an email-client-friendly document and inline CSS (Outlook/Gmail).
 */
import juice from "npm:juice@11.0.0";

const OUTBOUND_STYLES = `
body {
  margin: 0;
  padding: 16px;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: #222222;
}
p { margin: 0 0 1em 0; }
ul, ol { margin: 0 0 1em 0; padding-left: 24px; }
blockquote {
  margin: 0 0 1em 0;
  padding-left: 12px;
  border-left: 3px solid #cccccc;
  color: #444444;
}
img { max-width: 100%; height: auto; }
a { color: #1d4ed8; text-decoration: underline; }
`;

export function prepareOutboundHtml(fragment: string): string {
  const inner = (fragment || "<p></p>").trim();
  const document = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${OUTBOUND_STYLES}</style></head><body><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px"><tr><td>${inner}</td></tr></table></body></html>`;
  try {
    return juice(document, {
      removeStyleTags: true,
      preserveImportant: true,
    });
  } catch {
    return document;
  }
}
