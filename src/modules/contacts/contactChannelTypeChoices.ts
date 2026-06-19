/** Default email/phone type labels for contact forms and imports. */
export const DEFAULT_CONTACT_CHANNEL_TYPES = [
  "Work",
  "Mobile",
  "Home",
  "Other",
] as const;

export const buildContactChannelTypeChoices = (
  entries?: Array<{ type?: string | null } | null> | null,
) => {
  const seen = new Set<string>();
  const choices: Array<{ id: string }> = [];
  const add = (id: string) => {
    const trimmed = id.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    choices.push({ id: trimmed });
  };

  for (const type of DEFAULT_CONTACT_CHANNEL_TYPES) {
    add(type);
  }
  for (const entry of entries ?? []) {
    add(String(entry?.type ?? ""));
  }

  return choices;
};
