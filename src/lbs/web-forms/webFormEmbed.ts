import type { WebFormShareParams } from "@/lbs/web-forms/webFormLinks";
import {
  buildWebFormPreviewUrl,
  buildWebFormShareUrl,
} from "@/lbs/web-forms/webFormLinks";

export const WEB_FORM_EMBED_PARAM = "embed";

export const isWebFormEmbedMode = (searchParams: URLSearchParams) => {
  const value = searchParams.get(WEB_FORM_EMBED_PARAM);
  return value === "1" || value === "true";
};

export const appendWebFormEmbedParam = (url: string) => {
  const next = new URL(url);
  next.searchParams.set(WEB_FORM_EMBED_PARAM, "1");
  return next.toString();
};

export const buildWebFormEmbedUrl = (
  origin: string,
  slug: string,
  params: WebFormShareParams = {},
) => {
  const baseUrl = buildWebFormShareUrl(origin, slug, params);
  if (!baseUrl) {
    const previewUrl = buildWebFormPreviewUrl(origin, slug);
    if (!previewUrl) return "";
    return appendWebFormEmbedParam(previewUrl);
  }
  return appendWebFormEmbedParam(baseUrl);
};

export const buildWebFormIframeSnippet = (
  embedUrl: string,
  title = "Contact form",
) =>
  `<iframe\n  src="${embedUrl}"\n  title="${title.replace(/"/g, "&quot;")}"\n  style="width:100%;border:0;display:block;min-height:480px"\n  loading="lazy"\n></iframe>`;

export const buildWebFormScriptSnippet = (
  origin: string,
  slug: string,
  title = "Contact form",
) => {
  const baseOrigin = origin.replace(/\/$/, "");
  return `<div data-nomi-form="${slug}" data-nomi-origin="${baseOrigin}" data-nomi-title="${title.replace(/"/g, "&quot;")}"></div>\n<script src="${baseOrigin}/embed.js" async></script>`;
};

export const NOMI_FORM_RESIZE_MESSAGE = "nomi-form-resize";
