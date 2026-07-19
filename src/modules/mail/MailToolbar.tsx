import {
  Archive,
  ArrowBendUpLeft,
  ArrowBendDoubleUpLeft,
  ArrowBendUpRight,
  ArrowsClockwise,
  EnvelopeOpen,
  EnvelopeSimple,
  Star,
  Trash,
} from "@phosphor-icons/react";
import { IconButton } from "@/components/ui/icon-button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { MailThread } from "./types";

export function MailToolbar({
  thread,
  className,
  onReply,
  onReplyAll,
  onForward,
  onToggleStar,
  onArchive,
  onTrash,
  onToggleRead,
  onSync,
}: {
  thread: MailThread | null;
  className?: string;
  onReply: () => void;
  onReplyAll: () => void;
  onForward: () => void;
  onToggleStar: () => void;
  onArchive: () => void;
  onTrash: () => void;
  onToggleRead: () => void;
  onSync: () => void;
}) {
  const disabled = thread == null;

  return (
    <div
      className={cn(
        "flex h-10 shrink-0 items-center gap-0.5 border-b px-2",
        className,
      )}
    >
      <IconButton
        aria-label="Reply"
        disabled={disabled}
        onClick={onReply}
      >
        <ArrowBendUpLeft className="size-4" />
      </IconButton>
      <IconButton
        aria-label="Reply all"
        disabled={disabled}
        onClick={onReplyAll}
      >
        <ArrowBendDoubleUpLeft className="size-4" />
      </IconButton>
      <IconButton
        aria-label="Forward"
        disabled={disabled}
        onClick={onForward}
      >
        <ArrowBendUpRight className="size-4" />
      </IconButton>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <IconButton
        aria-label={thread?.is_starred ? "Unstar" : "Star"}
        disabled={disabled}
        onClick={onToggleStar}
      >
        <Star
          className="size-4"
          weight={thread?.is_starred ? "fill" : "regular"}
        />
      </IconButton>
      <IconButton
        aria-label={thread?.is_unread ? "Mark read" : "Mark unread"}
        disabled={disabled}
        onClick={onToggleRead}
      >
        {thread?.is_unread ? (
          <EnvelopeOpen className="size-4" />
        ) : (
          <EnvelopeSimple className="size-4" />
        )}
      </IconButton>
      <IconButton
        aria-label="Archive"
        disabled={disabled}
        onClick={onArchive}
      >
        <Archive className="size-4" />
      </IconButton>
      <IconButton
        aria-label="Move to trash"
        disabled={disabled}
        onClick={onTrash}
      >
        <Trash className="size-4" />
      </IconButton>

      <div className="ml-auto">
        <IconButton aria-label="Sync mailbox" onClick={onSync}>
          <ArrowsClockwise className="size-4" />
        </IconButton>
      </div>
    </div>
  );
}
