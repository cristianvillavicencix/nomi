import { MessageSquare } from "lucide-react";
import { Link } from "react-router";
import { useMessagesUnreadCounts } from "@/lbs/messages/useMessagesUnreadCounts";
import { formatUnreadBadgeCount } from "@/lbs/messages/messagesUnreadUtils";
import { cn } from "@/lib/utils";

export const GlobalMessagesBadge = ({ className }: { className?: string }) => {
  const { totalUnread } = useMessagesUnreadCounts();

  if (totalUnread <= 0) return null;

  return (
    <Link
      to="/messages"
      className={cn(
        "relative inline-flex size-10 items-center justify-center rounded-full bg-background/80 text-foreground shadow-md ring-1 ring-border/60 backdrop-blur-sm transition-colors hover:bg-accent",
        className,
      )}
      aria-label={`${totalUnread} unread messages`}
    >
      <MessageSquare className="size-5" />
      <span
        className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white"
        aria-hidden="true"
      >
        {formatUnreadBadgeCount(totalUnread)}
      </span>
    </Link>
  );
};
