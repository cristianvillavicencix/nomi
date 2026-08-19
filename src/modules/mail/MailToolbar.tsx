import { ArrowsClockwise, Envelope } from "@phosphor-icons/react";
import { IconButtonWithTooltip } from "@/components/admin/icon-button-with-tooltip";
import { cn } from "@/lib/utils";

export type MailSyncToolbarProps = {
  syncing?: boolean;
  onSync: () => void;
  unreadActive?: boolean;
  unreadCount?: number;
  onToggleUnread?: () => void;
};

/** Sync control for the mail list search row. */
export function MailSyncActionIcons({
  syncing = false,
  onSync,
  unreadActive = false,
  unreadCount = 0,
  onToggleUnread,
  className,
}: MailSyncToolbarProps & { className?: string }) {
  return (
    <div className={cn("flex shrink-0 items-center", className)}>
      {onToggleUnread ? (
        <IconButtonWithTooltip
          label={
            unreadActive
              ? "Show all conversations"
              : unreadCount > 0
                ? `Show unread (${unreadCount})`
                : "Show unread"
          }
          className="size-8 shrink-0"
          aria-pressed={unreadActive}
          onClick={onToggleUnread}
        >
          <Envelope
            className={cn("size-4", unreadActive && "text-primary")}
            weight={unreadActive ? "fill" : "regular"}
          />
        </IconButtonWithTooltip>
      ) : null}
      <IconButtonWithTooltip
        label="Sync mailbox"
        className="size-8 shrink-0"
        disabled={syncing}
        onClick={onSync}
      >
        <ArrowsClockwise className={cn("size-4", syncing && "animate-spin")} />
      </IconButtonWithTooltip>
    </div>
  );
}

/** @deprecated use MailSyncToolbarProps */
export type MailMailboxToolbarProps = MailSyncToolbarProps;

/** @deprecated use MailSyncActionIcons */
export const MailMailboxActionIcons = MailSyncActionIcons;
