import { appendWebFormEmbedParam } from "@/lbs/forms-v2/public/formEmbedUtils";

const supabaseUrl = () =>
  String(import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");

export const buildFormPublicUrl = (origin: string, token: string) =>
  `${origin.replace(/\/$/, "")}/forms/${token}`;

export const buildFormShortUrl = (origin: string, shortCode: string) =>
  `${origin.replace(/\/$/, "")}/f/${shortCode}`;

export const buildFormEmbedUrl = (origin: string, token: string) =>
  appendWebFormEmbedParam(buildFormPublicUrl(origin, token));

export const buildFormEmbedIframeSnippet = (embedUrl: string, title = "Form") =>
  `<iframe\n  src="${embedUrl}"\n  title="${title.replace(/"/g, "&quot;")}"\n  style="width:100%;border:0;display:block;min-height:600px"\n  loading="lazy"\n></iframe>`;

export const buildFormEmbedScriptSnippet = (token: string) => {
  const functionsBase = supabaseUrl();
  return `<!-- Embed in your website -->\n<div id="nomi-form-${token}"></div>\n<script src="${functionsBase}/functions/v1/forms_embed_js?token=${token}" async></script>`;
};
