import { ArrowsClockwise } from "@phosphor-icons/react";
import { IconButtonWithTooltip } from "@/components/admin/icon-button-with-tooltip";
import { cn } from "@/lib/utils";

export type MailSyncToolbarProps = {
  syncing?: boolean;
  onSync: () => void;
};

/** Sync control for the mail list search row. */
export function MailSyncActionIcons({
  syncing = false,
  onSync,
  className,
}: MailSyncToolbarProps & { className?: string }) {
  return (
    <IconButtonWithTooltip
      label="Sync mailbox"
      className={cn("size-8 shrink-0", className)}
      disabled={syncing}
      onClick={onSync}
    >
      <ArrowsClockwise className={cn("size-4", syncing && "animate-spin")} />
    </IconButtonWithTooltip>
  );
}

/** @deprecated use MailSyncToolbarProps */
export type MailMailboxToolbarProps = MailSyncToolbarProps;

/** @deprecated use MailSyncActionIcons */
export const MailMailboxActionIcons = MailSyncActionIcons;
