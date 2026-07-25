import {
  expandSignature,
  type SignatureContext,
} from "@/lib/signatures/signatureExpansion";

export type MessageTemplateContext = SignatureContext & {
  contact_first_name?: string;
  contact_last_name?: string;
  contact_full_name?: string;
  company_name?: string;
};

export const expandMessageTemplate = (
  template: string,
  context: MessageTemplateContext,
) => {
  const withUser = expandSignature(template, context);

  return withUser
    .replace(/\{\{contact_first_name\}\}/g, context.contact_first_name ?? "")
    .replace(/\{\{contact_last_name\}\}/g, context.contact_last_name ?? "")
    .replace(/\{\{contact_full_name\}\}/g, context.contact_full_name ?? "")
    .replace(/\{\{company_name\}\}/g, context.company_name ?? "");
};

export const templateTileLabel = (name: string, shortcutLabel?: string | null) => {
  const custom = shortcutLabel?.trim();
  if (custom) return custom.slice(0, 3).toUpperCase();
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  if (initials) return initials.slice(0, 3);
  return name.slice(0, 2).toUpperCase() || "?";
};

export const SHORTCUT_TILE_COLORS = [
  "#0d9488",
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#ea580c",
  "#ca8a04",
  "#059669",
  "#4f46e5",
] as const;

export const shortcutTileColor = (
  tileColor: string | null | undefined,
  index: number,
) => {
  const custom = tileColor?.trim();
  if (custom && /^#[0-9a-fA-F]{6}$/.test(custom)) return custom;
  return SHORTCUT_TILE_COLORS[index % SHORTCUT_TILE_COLORS.length];
};
