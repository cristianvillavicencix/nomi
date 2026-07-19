import {
  Tray,
  EnvelopeSimple,
  Star,
  Archive,
  Trash,
  Tag,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { MailAccount, MailLabel } from "./types";

export type MailFolderId =
  | "inbox"
  | "unread"
  | "starred"
  | "archived"
  | "trash";

const FOLDERS: Array<{
  id: MailFolderId;
  label: string;
  icon: typeof Tray;
}> = [
  { id: "inbox", label: "Inbox", icon: Tray },
  { id: "unread", label: "Unread", icon: EnvelopeSimple },
  { id: "starred", label: "Starred", icon: Star },
  { id: "archived", label: "Archived", icon: Archive },
  { id: "trash", label: "Trash", icon: Trash },
];

export function MailFolderRail({
  folder,
  onFolderChange,
  accounts,
  accountFilter,
  onAccountFilterChange,
  labels,
  labelId,
  onLabelChange,
  className,
}: {
  folder: MailFolderId;
  onFolderChange: (folder: MailFolderId) => void;
  accounts: MailAccount[];
  accountFilter: number | "all";
  onAccountFilterChange: (id: number | "all") => void;
  labels: MailLabel[];
  labelId: number | null;
  onLabelChange: (id: number | null) => void;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-[200px] shrink-0 flex-col border-r bg-muted/20",
        className,
      )}
    >
      <div className="border-b px-3 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Mailboxes
        </p>
        <nav className="mt-2 space-y-0.5">
          <button
            type="button"
            onClick={() => onAccountFilterChange("all")}
            className={cn(
              "flex w-full truncate rounded-md px-2 py-1.5 text-left text-sm",
              accountFilter === "all"
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
            )}
          >
            All accounts
          </button>
          {accounts.map((account) => (
            <button
              key={account.id}
              type="button"
              onClick={() => onAccountFilterChange(account.id)}
              className={cn(
                "flex w-full truncate rounded-md px-2 py-1.5 text-left text-sm",
                accountFilter === account.id
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
              )}
              title={account.email}
            >
              {account.email}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Folders
        </p>
        <nav className="mt-1.5 space-y-0.5">
          {FOLDERS.map((item) => {
            const Icon = item.icon;
            const active = folder === item.id && labelId == null;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onLabelChange(null);
                  onFolderChange(item.id);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                  active
                    ? "bg-primary/10 font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" weight={active ? "fill" : "regular"} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {labels.length > 0 ? (
          <>
            <p className="mt-4 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Labels
            </p>
            <nav className="mt-1.5 space-y-0.5">
              {labels.map((label) => {
                const active = labelId === label.id;
                return (
                  <button
                    key={label.id}
                    type="button"
                    onClick={() => {
                      onFolderChange("inbox");
                      onLabelChange(label.id);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                      active
                        ? "bg-primary/10 font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                    )}
                  >
                    <Tag
                      className="size-4 shrink-0"
                      style={label.color ? { color: label.color } : undefined}
                    />
                    <span className="truncate">{label.name}</span>
                  </button>
                );
              })}
            </nav>
          </>
        ) : null}
      </div>
    </aside>
  );
}
