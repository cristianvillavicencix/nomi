const DRAFT_PREFIX = "nomi_form_draft:";

export type FormDraftEnvelope<T = unknown> = {
  values: T;
  savedAt: number;
};

/** Keep drafts for one week — enough to recover after accidental navigation. */
export const FORM_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const readEnvelope = <T>(key: string): FormDraftEnvelope<T> | null => {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FormDraftEnvelope<T>;
    if (!parsed?.values || typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > FORM_DRAFT_MAX_AGE_MS) {
      localStorage.removeItem(DRAFT_PREFIX + key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const getFormDraft = <T>(key: string): T | null =>
  readEnvelope<T>(key)?.values ?? null;

export const setFormDraft = <T>(key: string, values: T) => {
  if (typeof localStorage === "undefined") return;
  try {
    const envelope: FormDraftEnvelope<T> = {
      values,
      savedAt: Date.now(),
    };
    localStorage.setItem(DRAFT_PREFIX + key, JSON.stringify(envelope));
  } catch {
    // Quota exceeded or private mode — ignore.
  }
};

export const clearFormDraft = (key: string) => {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(DRAFT_PREFIX + key);
  } catch {
    // ignore
  }
};

export const getFormDraftSavedAt = (key: string): number | null =>
  readEnvelope(key)?.savedAt ?? null;
