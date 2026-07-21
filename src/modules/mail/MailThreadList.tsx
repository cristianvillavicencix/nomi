import {
  Archive,
  ArrowBendUpLeft,
  ArrowBendUpRight,
  ArrowUUpLeft,
  Prohibit,
  Star,
  Trash,
} from "@phosphor-icons/react";
import { IconButtonWithTooltip } from "@/components/admin/icon-button-with-tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { MailThread } from "./types";

function formatListDate(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export type MailListTrashMode =
  | "trash"
  | "restore"
  | "delete_forever"
  | "not_spam";

export function MailThreadList({
  threads,
  selectedId,
  selectedIds,
  onToggleSelect,
  onSelect,
  onStar,
  onArchive,
  onRestore,
  onTrash,
  onSpam,
  onReply,
  onForward,
  showOrganizeActions = true,
  trashMode = "trash",
}: {
  threads: MailThread[];
  selectedId: number | null;
  selectedIds?: Set<number>;
  onToggleSelect?: (id: number, on: boolean) => void;
  onSelect: (thread: MailThread) => void;
  onStar?: (thread: MailThread) => void;
  onArchive?: (thread: MailThread) => void;
  onRestore?: (thread: MailThread) => void;
  onTrash?: (thread: MailThread) => void;
  onSpam?: (thread: MailThread) => void;
  onReply?: (thread: MailThread) => void;
  onForward?: (thread: MailThread) => void;
  showOrganizeActions?: boolean;
  trashMode?: MailListTrashMode;
}) {
  const trashAria =
    trashMode === "delete_forever"
      ? "Delete forever"
      : trashMode === "not_spam"
        ? "Not spam"
        : trashMode === "restore"
          ? "Restore from trash"
          : "Move to trash";

  if (threads.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
        <p className="text-sm font-medium">No conversations</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Sync a mailbox or try another folder.
        </p>
      </div>
    );
  }

  const hasHoverActions =
    showOrganizeActions &&
    (onStar ||
      onArchive ||
      onRestore ||
      onTrash ||
      onSpam ||
      onReply ||
      onForward);

  return (
    <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
      {threads.map((thread) => {
        const active = thread.id === selectedId;
        const checked = selectedIds?.has(thread.id) ?? false;
        const who =
          thread.participants
            ?.map((p) => p.name || p.email)
            .filter(Boolean)
            .slice(0, 2)
            .join(", ") || "Unknown";
        const subject = thread.subject || "(No subject)";
        return (
          <li
            key={thread.id}
            className={cn(
              "group relative flex items-stretch",
              active && "bg-muted",
              thread.is_unread && !active && "bg-primary/[0.04]",
            )}
          >
            {onToggleSelect ? (
              <div className="relative z-[1] flex items-start pt-3 pl-2">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) =>
                    onToggleSelect(thread.id, v === true)
                  }
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => onSelect(thread)}
              title={`${who} — ${subject}`}
              className={cn(
                "relative z-0 flex min-w-0 flex-1 flex-col gap-0.5 py-2.5 pr-2 text-left transition-colors",
                onToggleSelect ? "pl-1" : "pl-3",
                !active && "hover:bg-muted/50",
                hasHoverActions && "sm:pr-2",
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-sm",
                    thread.is_unread ? "font-semibold" : "font-medium",
                  )}
                >
                  {who}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-[11px] tabular-nums text-muted-foreground transition-opacity",
                    hasHoverActions &&
                      "sm:group-hover:opacity-0 sm:group-focus-within:opacity-0",
                  )}
                >
                  {formatListDate(thread.last_message_at)}
                </span>
                {thread.is_starred ? (
                  <Star
                    className={cn(
                      "size-3.5 shrink-0 text-amber-500",
                      hasHoverActions &&
                        "sm:group-hover:opacity-0 sm:group-focus-within:opacity-0",
                    )}
                    weight="fill"
                  />
                ) : null}
              </div>
              <span
                className={cn(
                  "truncate text-sm",
                  thread.is_unread ? "font-medium" : "text-muted-foreground",
                )}
              >
                {subject}
              </span>
              {thread.snippet ? (
                <span className="line-clamp-1 text-xs text-muted-foreground">
                  {thread.snippet}
                </span>
              ) : null}
            </button>
            {hasHoverActions ? (
              <div
                className={cn(
                  "absolute inset-y-0 right-0 z-[2] flex items-center gap-0 pl-8 pr-1",
                  "bg-gradient-to-l from-background from-55% via-background/90 to-transparent",
                  active && "from-muted via-muted/90",
                  "opacity-100 sm:pointer-events-none sm:opacity-0",
                  "sm:group-hover:pointer-events-auto sm:group-hover:opacity-100",
                  "sm:group-focus-within:pointer-events-auto sm:group-focus-within:opacity-100",
                )}
              >
                {onReply ? (
                  <IconButtonWithTooltip
                    label="Reply"
                    className="size-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      onReply(thread);
                    }}
                  >
                    <ArrowBendUpLeft className="size-4" />
                  </IconButtonWithTooltip>
                ) : null}
                {onForward ? (
                  <IconButtonWithTooltip
                    label="Forward"
                    className="size-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      onForward(thread);
                    }}
                  >
                    <ArrowBendUpRight className="size-4" />
                  </IconButtonWithTooltip>
                ) : null}
                {onStar ? (
                  <IconButtonWithTooltip
                    label={thread.is_starred ? "Unstar" : "Star"}
                    className="size-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStar(thread);
                    }}
                  >
                    <Star
                      className="size-4"
                      weight={thread.is_starred ? "fill" : "regular"}
                    />
                  </IconButtonWithTooltip>
                ) : null}
                {onRestore ? (
                  <IconButtonWithTooltip
                    label="Restore to inbox"
                    className="size-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRestore(thread);
                    }}
                  >
                    <ArrowUUpLeft className="size-4" />
                  </IconButtonWithTooltip>
                ) : null}
                {onArchive ? (
                  <IconButtonWithTooltip
                    label="Archive"
                    className="size-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      onArchive(thread);
                    }}
                  >
                    <Archive className="size-4" />
                  </IconButtonWithTooltip>
                ) : null}
                {onSpam ? (
                  <IconButtonWithTooltip
                    label="Report spam"
                    className="size-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSpam(thread);
                    }}
                  >
                    <Prohibit className="size-4" />
                  </IconButtonWithTooltip>
                ) : null}
                {onTrash ? (
                  <IconButtonWithTooltip
                    label={trashAria}
                    className="size-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTrash(thread);
                    }}
                  >
                    <Trash className="size-4" />
                  </IconButtonWithTooltip>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
