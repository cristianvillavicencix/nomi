import type { DealNote } from "../types";

export const ASSET_LINK_PREFIX = "asset-link:v1:";

export type AssetLinkKind = "documents" | "photos";

export type AssetLinkPayload = {
  kind: AssetLinkKind;
  url: string;
  title?: string;
  note?: string;
};

export type ParsedAssetLink = AssetLinkPayload & {
  noteId?: DealNote["id"];
  createdAt?: string;
};

export const serializeAssetLink = (payload: AssetLinkPayload) =>
  `${ASSET_LINK_PREFIX}${JSON.stringify(payload)}`;

export const parseAssetLinkText = (text?: string): AssetLinkPayload | null => {
  if (!text?.startsWith(ASSET_LINK_PREFIX)) return null;
  const raw = text.slice(ASSET_LINK_PREFIX.length);
  try {
    const parsed = JSON.parse(raw);
    if (
      (parsed.kind === "documents" || parsed.kind === "photos") &&
      typeof parsed.url === "string"
    ) {
      return {
        kind: parsed.kind,
        url: parsed.url,
        title: typeof parsed.title === "string" ? parsed.title : undefined,
        note: typeof parsed.note === "string" ? parsed.note : undefined,
      };
    }
  } catch {
    return null;
  }
  return null;
};

export const extractAssetLinksFromDealNotes = (notes: DealNote[]): ParsedAssetLink[] =>
  notes
    .map((note) => {
      const parsed = parseAssetLinkText(note.text);
      if (!parsed) return null;
      return {
        ...parsed,
        noteId: note.id,
        createdAt: note.date,
      } satisfies ParsedAssetLink;
    })
    .filter((item): item is ParsedAssetLink => item != null);

