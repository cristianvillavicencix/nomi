import { ticketStatusLabel } from "@/modules/tickets/ticketInboxConfig";

export type StatusChangeInternalNote = {
  fromStatus: string;
  toStatus: string;
  note: string;
};

const STATUS_LINE =
  /^\*{0,2}Status:\*{0,2}\s*(.+?)\s*(?:→|->|—|–)\s*(.+?)\s*$/i;

export const isStatusChangeInternalNote = (body?: string | null) => {
  const text = body?.trim();
  if (!text) return false;
  const first = text.split("\n").find((line) => line.trim()) ?? "";
  return STATUS_LINE.test(first.trim());
};

export const parseStatusChangeInternalNote = (
  body?: string | null,
): StatusChangeInternalNote | null => {
  if (!isStatusChangeInternalNote(body)) return null;

  const lines = (body ?? "")
    .split("\n")
    .map((line) => line.trimEnd());
  const firstIdx = lines.findIndex((line) => line.trim());
  if (firstIdx < 0) return null;

  const match = lines[firstIdx].trim().match(STATUS_LINE);
  if (!match) return null;

  const fromStatus = match[1].replace(/\*+/g, "").trim();
  const toStatus = match[2].replace(/\*+/g, "").trim();
  const note = lines
    .slice(firstIdx + 1)
    .join("\n")
    .replace(/^\n+/, "")
    .trim();

  if (!fromStatus || !toStatus) return null;

  return { fromStatus, toStatus, note };
};

export const previewStatusChangeInternalNote = (body?: string | null) => {
  const parsed = parseStatusChangeInternalNote(body);
  if (!parsed) return null;
  const from = ticketStatusLabel(parsed.fromStatus);
  const to = ticketStatusLabel(parsed.toStatus);
  const head = `Status ${from} → ${to}`;
  if (!parsed.note) return head;
  const noteOneLine = parsed.note.replace(/\s+/g, " ").trim();
  return `${head} · ${noteOneLine}`;
};

export const formatStatusChangeInternalNoteBody = (
  fromStatus: string,
  toStatus: string,
  note: string,
) => `Status: ${fromStatus} → ${toStatus}\n\n${note.trim()}`;
