import { Star } from "@phosphor-icons/react";
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

export function MailThreadList({
  threads,
  selectedId,
  selectedIds,
  onToggleSelect,
  onSelect,
}: {
  threads: MailThread[];
  selectedId: number | null;
  selectedIds?: Set<number>;
  onToggleSelect?: (id: number, on: boolean) => void;
  onSelect: (thread: MailThread) => void;
}) {
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
        return (
          <li
            key={thread.id}
            className={cn(
              "group flex items-stretch gap-1",
              active && "bg-muted",
              thread.is_unread && !active && "bg-primary/[0.04]",
            )}
          >
            {onToggleSelect ? (
              <div className="flex items-start pt-3 pl-2">
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
              className={cn(
                "flex min-w-0 flex-1 flex-col gap-0.5 px-2 py-2.5 text-left transition-colors",
                !active && "hover:bg-muted/50",
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-sm",
                    thread.is_unread ? "font-semibold" : "font-medium",
                  )}
                >
                  {who}
                </span>
                {thread.is_starred ? (
                  <Star className="size-3.5 shrink-0 text-amber-500" weight="fill" />
                ) : null}
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  {formatListDate(thread.last_message_at)}
                </span>
              </div>
              <span
                className={cn(
                  "truncate text-sm",
                  thread.is_unread ? "font-medium" : "text-muted-foreground",
                )}
              >
                {thread.subject || "(No subject)"}
              </span>
              {thread.snippet ? (
                <span className="line-clamp-1 text-xs text-muted-foreground">
                  {thread.snippet}
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
