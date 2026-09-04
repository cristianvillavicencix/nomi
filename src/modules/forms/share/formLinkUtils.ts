import { appendWebFormEmbedParam } from "@/modules/forms/public/formEmbedUtils";

const supabaseUrl = () =>
  String(import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");

export const buildFormPublicUrl = (origin: string, token: string) =>
  `${origin.replace(/\/$/, "")}/forms/${token}`;

export const buildFormShortUrl = (origin: string, shortCode: string) =>
  `${origin.replace(/\/$/, "")}/f/${shortCode}`;

export const buildFormEmbedUrl = (origin: string, token: string) =>
  appendWebFormEmbedParam(buildFormPublicUrl(origin, token));

/** Prefer short `/f/{code}` when the token API returns it. */
export const resolveShareUrl = (
  result: { url: string; short_url?: string | null },
  origin: string,
) => {
  const baseOrigin = origin.replace(/\/$/, "");
  const absolute = (value: string) =>
    value.startsWith("http") ? value : `${baseOrigin}${value}`;
  const short = String(result.short_url ?? "").trim();
  if (short) return absolute(short);
  return absolute(String(result.url ?? "").trim() || "/");
};

export const buildFormEmbedIframeSnippet = (embedUrl: string, title = "Form") =>
  `<iframe\n  src="${embedUrl}"\n  title="${title.replace(/"/g, "&quot;")}"\n  style="width:100%;border:0;display:block;min-height:600px"\n  loading="lazy"\n></iframe>`;

export const buildFormEmbedScriptSnippet = (token: string) => {
  const functionsBase = supabaseUrl();
  return `<!-- Embed in your website -->\n<div id="nomi-form-${token}"></div>\n<script src="${functionsBase}/functions/v1/forms_embed_js?token=${token}" async></script>`;
};
