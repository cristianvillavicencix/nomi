import { formatDistanceToNow } from "date-fns";
import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  NOTIFICATION_CATEGORY_ACCENT,
  NOTIFICATION_CATEGORY_ICONS,
} from "@/modules/notifications/notificationDisplay";
import { markNotificationHistoryRead } from "@/modules/notifications/notificationHistory";
import type { NotificationHistoryItem } from "@/modules/notifications/types";

const PREVIEW_EVENT = "nomi:notification-preview";
const OPEN_CENTER_EVENT = "nomi:open-notification-center";
const AUTO_DISMISS_MS = 6_000;
const MAX_VISIBLE = 3;

type PreviewRow = NotificationHistoryItem & {
  visible: boolean;
  dismissing: boolean;
};

export const openNotificationCenter = () => {
  window.dispatchEvent(new CustomEvent(OPEN_CENTER_EVENT));
};

export const NotificationPreviewLayer = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<PreviewRow[]>([]);

  const dismissRow = useCallback((id: string) => {
    setRows((current) =>
      current.map((row) =>
        row.id === id ? { ...row, dismissing: true, visible: false } : row,
      ),
    );
    window.setTimeout(() => {
      setRows((current) => current.filter((row) => row.id !== id));
    }, 320);
  }, []);

  const handleOpen = useCallback(
    (item: NotificationHistoryItem) => {
      markNotificationHistoryRead(item.id);
      dismissRow(item.id);
      if (item.href) {
        navigate(item.href);
        return;
      }
      openNotificationCenter();
    },
    [dismissRow, navigate],
  );

  useEffect(() => {
    const onPreview = (event: Event) => {
      const item = (event as CustomEvent<NotificationHistoryItem>).detail;
      if (!item?.id) return;

      setRows((current) => {
        const withoutDup = current.filter((row) => row.id !== item.id);
        const next: PreviewRow[] = [
          { ...item, visible: false, dismissing: false },
          ...withoutDup,
        ].slice(0, MAX_VISIBLE);
        return next;
      });

      window.requestAnimationFrame(() => {
        setRows((current) =>
          current.map((row) =>
            row.id === item.id ? { ...row, visible: true } : row,
          ),
        );
      });

      window.setTimeout(() => {
        dismissRow(item.id);
      }, AUTO_DISMISS_MS);
    };

    window.addEventListener(PREVIEW_EVENT, onPreview);
    return () => window.removeEventListener(PREVIEW_EVENT, onPreview);
  }, [dismissRow]);

  if (rows.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed top-14 right-3 z-[60] flex w-[min(100vw-1.5rem,22rem)] flex-col gap-2 sm:right-4"
      aria-live="polite"
    >
      {rows.map((row) => {
        const Icon = NOTIFICATION_CATEGORY_ICONS[row.category];
        const accent = NOTIFICATION_CATEGORY_ACCENT[row.category];

        return (
          <div
            key={row.id}
            className={cn(
              "pointer-events-auto overflow-hidden rounded-lg border bg-background shadow-lg transition-all duration-300 ease-out",
              row.visible && !row.dismissing
                ? "translate-x-0 opacity-100"
                : "translate-x-6 opacity-0",
              row.dismissing && "-translate-y-2 scale-[0.98]",
            )}
          >
            <div className="flex gap-3 p-3">
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-md",
                  accent,
                )}
              >
                <Icon className="size-4" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-snug">{row.title}</p>
                  <button
                    type="button"
                    className="shrink-0 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
                    aria-label="Dismiss"
                    onClick={() => dismissRow(row.id)}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                {row.body ? (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {row.body}
                  </p>
                ) : null}
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(row.created_at), {
                    addSuffix: true,
                  })}
                </p>
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => handleOpen(row)}
                  >
                    {row.href ? "Open" : "View"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-muted-foreground"
                    onClick={() => {
                      dismissRow(row.id);
                      openNotificationCenter();
                    }}
                  >
                    All notifications
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const dispatchNotificationPreview = (item: NotificationHistoryItem) => {
  window.dispatchEvent(
    new CustomEvent(PREVIEW_EVENT, {
      detail: item,
    }),
  );
};
