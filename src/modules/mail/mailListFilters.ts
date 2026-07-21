import type { MailFolderId } from "./MailFolderRail";
import type { MailThread } from "./types";

export type MailListFilter =
  | "all"
  | "unread"
  | "starred"
  | "archived";

export function filterMailThreadsByListFilter(
  threads: MailThread[],
  folder: MailFolderId,
  listFilter: MailListFilter,
): MailThread[] {
  if (folder === "draft") return threads;

  switch (listFilter) {
    case "unread":
      return threads.filter((t) => t.is_unread);
    case "starred":
      return threads.filter((t) => t.is_starred);
    case "archived":
      return threads;
    case "all":
    default:
      return threads;
  }
}

export function countMailListFilters(
  threads: MailThread[],
  folder: MailFolderId,
): Partial<Record<MailListFilter, number>> {
  if (folder !== "inbox") {
    return {
      all: threads.length,
      unread: threads.filter((t) => t.is_unread).length,
    };
  }
  return {
    all: threads.filter(
      (t) =>
        !t.is_archived && !t.is_trashed && !t.is_draft && !t.is_spam,
    ).length,
    unread: threads.filter(
      (t) =>
        t.is_unread &&
        !t.is_archived &&
        !t.is_trashed &&
        !t.is_spam,
    ).length,
    starred: threads.filter((t) => t.is_starred && !t.is_trashed).length,
    archived: threads.filter((t) => t.is_archived && !t.is_trashed).length,
  };
}
