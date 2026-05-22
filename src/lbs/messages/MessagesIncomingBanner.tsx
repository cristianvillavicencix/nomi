import { useEffect } from "react";
import { MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type IncomingMessageNotification = {
  id: string;
  conversationId: string;
  title: string;
  preview: string;
};

export const MessagesIncomingBannerStack = ({
  notifications,
  onDismiss,
  onOpen,
}: {
  notifications: IncomingMessageNotification[];
  onDismiss: (id: string) => void;
  onOpen: (notification: IncomingMessageNotification) => void;
}) => {
  useEffect(() => {
    if (notifications.length === 0) return;
    const timers = notifications.map((notification) =>
      window.setTimeout(() => onDismiss(notification.id), 6000),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [notifications, onDismiss]);

  if (notifications.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[10050] flex flex-col items-center gap-2 px-4 sm:top-4">
      {notifications.map((notification, index) => (
        <div
          key={notification.id}
          className={cn(
            "pointer-events-auto w-full max-w-md animate-in slide-in-from-top-4 fade-in duration-300",
            index > 0 && "opacity-95",
          )}
        >
          <button
            type="button"
            onClick={() => onOpen(notification)}
            className="flex w-full items-start gap-3 rounded-2xl border bg-background/95 px-4 py-3 text-left shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/85"
          >
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MessageSquare className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{notification.title}</span>
              <span className="mt-0.5 block line-clamp-2 text-sm text-muted-foreground">
                {notification.preview}
              </span>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 rounded-full"
              aria-label="Dismiss notification"
              onClick={(event) => {
                event.stopPropagation();
                onDismiss(notification.id);
              }}
            >
              <X className="size-4" />
            </Button>
          </button>
        </div>
      ))}
    </div>
  );
};
