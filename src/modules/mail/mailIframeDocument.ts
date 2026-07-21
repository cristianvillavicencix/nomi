import { sanitizeMailHtml } from "./sanitizeMailHtml";

const IFRAME_RESET_CSS = `
  html, body { margin: 0; padding: 0; background: #ffffff; }
  body {
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 13px;
    line-height: 1.45;
    color: #171717;
    word-break: break-word;
    overflow-x: auto;
  }
  img { max-width: 100%; height: auto; }
  table { max-width: 100%; border-collapse: collapse; }
  td, th { word-break: break-word; }
  a { color: #1d4ed8; text-decoration: underline; }
  pre { white-space: pre-wrap; overflow-x: auto; }
  blockquote { margin: 0.5em 0; padding-left: 1ex; border-left: 1px solid #ccc; }
`;

/** Full HTML document for sandboxed iframe email rendering. */
export function buildMailIframeSrcDoc(rawHtml: string): string {
  const body = sanitizeMailHtml(rawHtml);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><base target="_blank" rel="noopener noreferrer"><style>${IFRAME_RESET_CSS}</style></head><body>${body}</body></html>`;
}
