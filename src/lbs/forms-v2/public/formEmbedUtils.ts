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

export const NOMI_FORM_RESIZE_MESSAGE = "nomi-form-resize";
