import { MessageSquare } from "lucide-react";
import { Link, useLocation } from "react-router";
import { useMessagesUnreadCounts } from "@/lbs/messages/useMessagesUnreadCounts";
import { formatUnreadBadgeCount } from "@/lbs/messages/messagesUnreadUtils";
import { cn } from "@/lib/utils";

export const GlobalMessagesBadge = ({ className }: { className?: string }) => {
  const { totalUnread } = useMessagesUnreadCounts();
  const location = useLocation();
  const isMessagesPage = location.pathname.startsWith("/messages");

  if (isMessagesPage) return null;

  return (
    <Link
      to="/messages"
      className={cn(
        "relative inline-flex size-12 items-center justify-center rounded-full bg-blue-500 text-white shadow-lg ring-1 ring-blue-400/40 transition-colors hover:bg-blue-600",
        className,
      )}
      aria-label={
        totalUnread > 0
          ? `${totalUnread} unread messages`
          : "Open messages"
      }
    >
      <MessageSquare className="size-5" />
      {totalUnread > 0 ? (
        <span
          className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-white px-1 text-[11px] font-semibold leading-none text-blue-600 shadow-sm"
          aria-hidden="true"
        >
          {formatUnreadBadgeCount(totalUnread)}
        </span>
      ) : null}
    </Link>
  );
};
