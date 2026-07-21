import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { MailThread } from "./types";
import { Star } from "@phosphor-icons/react";

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
    <ul className="min-h-0 flex-1 overflow-y-auto">
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
              "relative flex items-stretch",
              active && "bg-muted/80",
              thread.is_unread && !active && "bg-primary/[0.03]",
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
                "relative z-0 flex min-w-0 flex-1 flex-col gap-0.5 py-2.5 pr-3 text-left transition-colors",
                onToggleSelect ? "pl-1" : "pl-3",
                !active && "hover:bg-muted/50",
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
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  {formatListDate(thread.last_message_at)}
                </span>
                {thread.is_starred ? (
                  <Star
                    className="size-3.5 shrink-0 text-amber-500"
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
          </li>
        );
      })}
    </ul>
  );
}
