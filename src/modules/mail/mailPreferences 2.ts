import type { MailFolderId } from "./MailFolderRail";

const MAIL_ACCOUNT_FILTER_KEY = "nomi.mail.accountFilter";
const MAIL_FOLDER_KEY = "nomi.mail.folder";

export type MailFolderPreference = MailFolderId;

export function readMailAccountFilter(): number | "all" {
  if (typeof window === "undefined") return "all";
  try {
    const raw = localStorage.getItem(MAIL_ACCOUNT_FILTER_KEY);
    if (raw == null || raw === "" || raw === "all") return "all";
    const id = Number(raw);
    if (!Number.isFinite(id) || id <= 0) return "all";
    return id;
  } catch {
    return "all";
  }
}

export function writeMailAccountFilter(value: number | "all"): void {
  if (typeof window === "undefined") return;
  try {
    if (value === "all") {
      localStorage.setItem(MAIL_ACCOUNT_FILTER_KEY, "all");
    } else {
      localStorage.setItem(MAIL_ACCOUNT_FILTER_KEY, String(value));
    }
  } catch {
    /* ignore quota / private mode */
  }
}

export function readMailFolder(): MailFolderPreference {
  if (typeof window === "undefined") return "inbox";
  try {
    const raw = localStorage.getItem(MAIL_FOLDER_KEY);
    if (
      raw === "inbox" ||
      raw === "starred" ||
      raw === "sent" ||
      raw === "draft" ||
      raw === "archive" ||
      raw === "trash" ||
      raw === "spam"
    ) {
      return raw;
    }
  } catch {
    /* ignore */
  }
  return "inbox";
}

export function writeMailFolder(folder: MailFolderPreference): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(MAIL_FOLDER_KEY, folder);
  } catch {
    /* ignore */
  }
}
