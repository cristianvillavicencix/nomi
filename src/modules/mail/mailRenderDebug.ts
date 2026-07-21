import { extractEmailHeadAssets, sanitizeMailHtmlParts } from "./sanitizeMailHtml";
import { listBlockedStylesheetHrefs } from "./mailRenderAllowlist";

export type MailRenderWarning = {
  code:
    | "stylesheet_host_blocked"
    | "cid_reference"
    | "script_forbidden"
    | "large_html_shrink"
    | "no_tables"
    | "no_images";
  message: string;
};

export type MailRenderDebugReport = {
  rawBytes: number;
  sanitizedBodyBytes: number;
  extractedStyleBytes: number;
  styleLinkCountAllowed: number;
  styleLinkCountBlocked: number;
  blockedStylesheetHrefs: string[];
  tableCount: number;
  imgCount: number;
  imgHttpsCount: number;
  cidCount: number;
  nestedBodyCount: number;
  hasMailBodyRoot: boolean;
  warnings: MailRenderWarning[];
};

function countMatches(text: string, pattern: RegExp): number {
  const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  return [...text.matchAll(re)].length;
}

/** Dev / QA summary of how raw synced HTML will render in the iframe reader. */
export function analyzeMailRenderPipeline(rawHtml: string): MailRenderDebugReport {
  const rawBytes = new TextEncoder().encode(rawHtml).length;
  const cidCount = countMatches(rawHtml, /cid:/gi);
  const { headLinks } = extractEmailHeadAssets(rawHtml);
  const styleLinkCountAllowed = countMatches(headLinks, /<link\b/gi);
  const blockedStylesheetHrefs = listBlockedStylesheetHrefs(rawHtml);
  const styleLinkCountBlocked = blockedStylesheetHrefs.length;

  const { body, emailStyles } = sanitizeMailHtmlParts(rawHtml);
  const sanitizedBodyBytes = new TextEncoder().encode(body).length;
  const extractedStyleBytes = new TextEncoder().encode(emailStyles).length;

  const tableCount = countMatches(body, /<table\b/gi);
  const imgCount = countMatches(body, /<img\b/gi);
  const imgHttpsCount = countMatches(body, /<img\b[^>]*\bsrc\s*=\s*["']https:/gi);
  const nestedBodyCount = countMatches(body, /mail-nested-body/g);

  const warnings: MailRenderWarning[] = [];

  if (styleLinkCountBlocked > 0) {
    const sample = blockedStylesheetHrefs.slice(0, 3).join(", ");
    warnings.push({
      code: "stylesheet_host_blocked",
      message: `${styleLinkCountBlocked} stylesheet link(s) blocked (${sample}${styleLinkCountBlocked > 3 ? ", …" : ""}).`,
    });
  }
  if (cidCount > 0) {
    warnings.push({
      code: "cid_reference",
      message: `${cidCount} cid: reference(s) — inline images need attachment sync.`,
    });
  }
  if (/<script\b/i.test(rawHtml)) {
    warnings.push({
      code: "script_forbidden",
      message: "Script tags are stripped (expected).",
    });
  }
  if (rawBytes > 2000 && sanitizedBodyBytes < rawBytes * 0.35) {
    warnings.push({
      code: "large_html_shrink",
      message: `Sanitized body is much smaller than raw (${sanitizedBodyBytes} vs ${rawBytes} bytes).`,
    });
  }
  if (tableCount === 0 && rawBytes > 500) {
    warnings.push({
      code: "no_tables",
      message: "No tables in sanitized body — unusual for HTML newsletters.",
    });
  }
  if (imgCount === 0 && /<img\b/i.test(rawHtml)) {
    warnings.push({
      code: "no_images",
      message: "Images were removed during sanitize (cid or empty src).",
    });
  }

  return {
    rawBytes,
    sanitizedBodyBytes,
    extractedStyleBytes,
    styleLinkCountAllowed,
    styleLinkCountBlocked,
    blockedStylesheetHrefs,
    tableCount,
    imgCount,
    imgHttpsCount,
    cidCount,
    nestedBodyCount,
    hasMailBodyRoot: body.includes("mail-body-root"),
    warnings,
  };
}

export const MAIL_RENDER_DEBUG_STORAGE_KEY = "nomi-mail-render-debug";

export function isMailRenderDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (!import.meta.env.DEV) return false;
  try {
    if (new URLSearchParams(window.location.search).get("mailDebug") === "1") {
      return true;
    }
    return window.localStorage.getItem(MAIL_RENDER_DEBUG_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMailRenderDebugEnabled(on: boolean): void {
  try {
    if (on) {
      window.localStorage.setItem(MAIL_RENDER_DEBUG_STORAGE_KEY, "1");
    } else {
      window.localStorage.removeItem(MAIL_RENDER_DEBUG_STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
}
