import { useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { MailAccountAvatar } from "./mailAccountAvatar";
import type { MailAccount, MailThread } from "./types";
import { Star } from "@phosphor-icons/react";

const RECENT_UNREAD_HOURS = 4;

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

function isRecentThread(iso: string | null): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t <= RECENT_UNREAD_HOURS * 60 * 60 * 1000;
}

function mailboxLabel(account: MailAccount): string {
  return account.display_name?.trim() || account.email;
}

export function MailThreadList({
  threads,
  selectedId,
  selectedIds,
  onToggleSelect,
  onSelect,
  accounts = [],
  showMailboxAvatar = false,
}: {
  threads: MailThread[];
  selectedId: number | null;
  selectedIds?: Set<number>;
  onToggleSelect?: (id: number, on: boolean) => void;
  onSelect: (thread: MailThread) => void;
  accounts?: MailAccount[];
  showMailboxAvatar?: boolean;
}) {
  const accountById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );

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
        const mailboxAccount = accountById.get(thread.account_id);
        const unread = thread.is_unread && !active;
        const recentUnread = unread && isRecentThread(thread.last_message_at);
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
              "relative flex items-stretch border-b border-border/40 transition-colors duration-150",
              active && "bg-primary/10 shadow-[inset_0_0_0_1px] shadow-primary/10",
              recentUnread && "bg-primary/10",
              unread && !recentUnread && "bg-primary/8",
              !active && "hover:bg-muted/45",
            )}
          >
            {active ? (
              <span
                className="absolute inset-y-0 left-0 z-[2] w-[3px] rounded-r-sm bg-primary"
                aria-hidden
              />
            ) : null}
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
              title={
                showMailboxAvatar && mailboxAccount
                  ? `${mailboxLabel(mailboxAccount)} · ${who} — ${subject}`
                  : `${who} — ${subject}`
              }
              className={cn(
                "relative z-0 flex min-w-0 flex-1 gap-2 py-2.5 pr-3 text-left transition-colors duration-150",
                onToggleSelect ? "pl-2" : "pl-3",
              )}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex min-w-0 items-center gap-2">
                  {unread ? (
                    <span
                      className="size-2 shrink-0 rounded-full bg-primary"
                      aria-label="Unread"
                    />
                  ) : null}
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-sm",
                      unread || active
                        ? "font-semibold text-foreground"
                        : "font-medium text-muted-foreground",
                    )}
                  >
                    {who}
                  </span>
                  {recentUnread ? (
                    <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      New
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      "shrink-0 text-[11px] tabular-nums",
                      unread
                        ? "font-medium text-foreground/80"
                        : "text-muted-foreground",
                    )}
                  >
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
                    unread
                      ? "font-medium text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {subject}
                </span>
                {thread.snippet ? (
                  <span
                    className={cn(
                      "line-clamp-1 text-xs",
                      unread ? "text-foreground/70" : "text-muted-foreground",
                    )}
                  >
                    {thread.snippet}
                  </span>
                ) : null}
              </div>
              {showMailboxAvatar && mailboxAccount ? (
                <span
                  className="mt-0.5 shrink-0 self-start"
                  title={mailboxLabel(mailboxAccount)}
                >
                  <MailAccountAvatar
                    account={mailboxAccount}
                    size="xs"
                    className="ring-1 ring-border/60 shadow-sm"
                  />
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
