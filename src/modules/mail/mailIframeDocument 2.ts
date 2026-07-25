import { rewriteHostingerLogoImagesInHtml } from "./hostingerLogo";
import { sanitizeMailHtmlParts } from "./sanitizeMailHtml";

export type MailIframeVariant = "reader" | "embedded";
export type MailIframeLayout = "fill" | "auto";

/** Shell chrome only — sender CSS loads after this so it wins. */
const READER_SHELL_FILL = `
  html.mail-reader-html {
    margin: 0;
    padding: 0;
    height: 100%;
    overflow: hidden;
    -webkit-text-size-adjust: 100%;
  }
  body.mail-reader-shell {
    margin: 0;
    padding: 16px 16px 32px;
    height: 100%;
    box-sizing: border-box;
    background: #ffffff;
    overflow-x: auto;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
  body.mail-reader-shell .mail-body-root,
  body.mail-reader-shell .mail-nested-body {
    display: block;
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
    margin: 0 auto;
    overflow: visible !important;
  }
  body.mail-reader-shell .mail-body-root img,
  body.mail-reader-shell .mail-nested-body img {
    max-width: 100%;
  }
`;

const READER_SHELL_AUTO = `
  html.mail-reader-html {
    margin: 0;
    padding: 0;
    height: auto !important;
    min-height: 0;
    -webkit-text-size-adjust: 100%;
  }
  body.mail-reader-shell {
    margin: 0;
    padding: 16px 16px 32px;
    height: auto !important;
    min-height: 0;
    background: #ffffff;
    overflow-x: auto;
    overflow-y: visible;
  }
  body.mail-reader-shell .mail-body-root,
  body.mail-reader-shell .mail-nested-body {
    display: block;
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
    margin: 0 auto;
    overflow: visible !important;
  }
  body.mail-reader-shell .mail-body-root img,
  body.mail-reader-shell .mail-nested-body img {
    max-width: 100%;
  }
`;

/** Restore readable spacing when senders zero out paragraph margins (Apple Mail, CRM compose). */
const READER_TYPOGRAPHY = `
body.mail-reader-shell .mail-body-root,
body.mail-reader-shell .mail-nested-body {
  line-height: 1.55;
  word-wrap: break-word;
}
body.mail-reader-shell .mail-body-root p,
body.mail-reader-shell .mail-nested-body p {
  margin-block: 0 0.85em !important;
}
body.mail-reader-shell .mail-body-root p:last-child,
body.mail-reader-shell .mail-nested-body p:last-child {
  margin-block-end: 0 !important;
}
body.mail-reader-shell .mail-body-root li,
body.mail-reader-shell .mail-nested-body li {
  margin-block: 0.25em 0.25em;
}
`;

/** Minimal post-sender overrides for responsive newsletter classes only. */
const READER_LAYOUT_UNLOCK = `
body.mail-reader-shell .mobile_only {
  display: none !important;
}
`;

const EMBEDDED_SHELL = `
  html.mail-reader-html, body.mail-reader-shell {
    margin: 0;
    padding: 0;
    height: auto !important;
    min-height: 0;
    background: #ffffff;
    -webkit-text-size-adjust: 100%;
  }
  body.mail-reader-shell .mail-body-root,
  body.mail-reader-shell .mail-nested-body {
    max-width: 100%;
  }
  body.mail-reader-shell .mail-body-root img,
  body.mail-reader-shell .mail-nested-body img {
    max-width: 100%;
  }
`;

function escapeStyleText(css: string): string {
  return css.replace(/<\/style/gi, "<\\/style");
}

/** Full HTML document for sandboxed iframe email rendering. */
export function buildMailIframeSrcDoc(
  rawHtml: string,
  variant: MailIframeVariant = "reader",
  layout: MailIframeLayout = "fill",
): string {
  const { body, emailStyles, headLinks } = sanitizeMailHtmlParts(
    rewriteHostingerLogoImagesInHtml(rawHtml),
  );
  const bodyHtml = body.includes("mail-body-root")
    ? body
    : `<div class="mail-body-root">${body}</div>`;
  const shellCss =
    variant === "embedded"
      ? EMBEDDED_SHELL
      : layout === "fill"
        ? READER_SHELL_FILL
        : READER_SHELL_AUTO;
  const senderCss = emailStyles.trim()
    ? `<style>${escapeStyleText(emailStyles)}</style>`
    : "";
  const readerUnlockCss =
    variant === "reader"
      ? `<style>${escapeStyleText(READER_LAYOUT_UNLOCK)}</style><style>${escapeStyleText(READER_TYPOGRAPHY)}</style>`
      : "";
  const viewportMeta =
    variant === "reader"
      ? '<meta name="viewport" content="width=680">'
      : "";
  return `<!DOCTYPE html><html lang="en" class="mail-reader-html"><head><meta charset="utf-8">${viewportMeta}<base target="_blank" rel="noopener noreferrer"><style>${shellCss}</style>${headLinks}${senderCss}${readerUnlockCss}</head><body class="mail-reader-shell">${bodyHtml}</body></html>`;
}
