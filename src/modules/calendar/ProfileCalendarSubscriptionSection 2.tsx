import { Calendar, Copy, Loader2, RefreshCw } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useGetIdentity, useDataProvider, useNotify } from "ra-core";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { hasMemberCapability } from "@/components/atomic-crm/providers/commons/memberModuleAccess";
import type { AccessIdentity } from "@/components/atomic-crm/providers/commons/canAccess";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { CalendarFeedUrls } from "@/modules/calendar/calendarFeedUrls";

export const ProfileCalendarSubscriptionSection = () => {
  const notify = useNotify();
  const { identity } = useGetIdentity();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [copiedField, setCopiedField] = useState<"webcal" | "https" | null>(
    null,
  );
  const [feed, setFeed] = useState<CalendarFeedUrls | null>(null);
  const [regenerateOpen, setRegenerateOpen] = useState(false);

  const canSubscribe = hasMemberCapability(
    identity as AccessIdentity | undefined,
    "calendar.view",
  );

  const { mutate: loadFeed, isPending: loading } = useMutation({
    mutationFn: () => dataProvider.ensureCalendarFeedToken(),
    onSuccess: (data) => {
      setFeed(data);
    },
    onError: () => {
      notify("Could not load your calendar subscription link.", {
        type: "error",
      });
    },
  });

  const { mutate: regenerateFeed, isPending: regenerating } = useMutation({
    mutationFn: () => dataProvider.ensureCalendarFeedToken({ regenerate: true }),
    onSuccess: (data) => {
      setFeed(data);
      setRegenerateOpen(false);
      notify("Calendar subscription link regenerated.", { type: "success" });
    },
    onError: () => {
      notify("Could not regenerate your calendar subscription link.", {
        type: "error",
      });
    },
  });

  useEffect(() => {
    if (canSubscribe) {
      loadFeed();
    }
  }, [canSubscribe, loadFeed]);

  const copyValue = useCallback(
    async (value: string, field: "webcal" | "https") => {
      try {
        await navigator.clipboard.writeText(value);
        setCopiedField(field);
        notify("Copied to clipboard.", { type: "success" });
        setTimeout(() => setCopiedField(null), 1500);
      } catch {
        notify("Could not copy to clipboard.", { type: "error" });
      }
    },
    [notify],
  );

  if (!canSubscribe) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Calendar className="h-5 w-5" />
            Apple Calendar subscription
          </CardTitle>
          <CardDescription>
            Subscribe on your iPhone or Mac with a private WebCal link. Nomi
            syncs your assigned tasks, calendar events, and confirmed bookings.
            Apple refreshes subscribed calendars periodically (usually every few
            hours).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && !feed ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading subscription link…
            </div>
          ) : feed ? (
            <>
              <div className="space-y-2">
                <p className="text-sm font-medium">iPhone / Mac (recommended)</p>
                <CopyRow
                  label="WebCal URL"
                  value={feed.webcal_url}
                  copied={copiedField === "webcal"}
                  onCopy={() => copyValue(feed.webcal_url, "webcal")}
                />
                <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>Copy the WebCal URL.</li>
                  <li>
                    On iPhone: Settings → Calendar → Accounts → Add Account →
                    Other → Add Subscribed Calendar, then paste the URL.
                  </li>
                  <li>
                    Or open the link on your phone to add it directly in Calendar.
                  </li>
                </ol>
                <Button asChild variant="secondary" className="w-full sm:w-auto">
                  <a href={feed.webcal_url}>Open in Calendar</a>
                </Button>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">HTTPS feed (other apps)</p>
                <CopyRow
                  label="iCal URL"
                  value={feed.feed_url}
                  copied={copiedField === "https"}
                  onCopy={() => copyValue(feed.feed_url, "https")}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Keep this link private. Anyone with the URL can read your Nomi
                calendar items included in the feed.
              </p>

              <Button
                type="button"
                variant="secondary"
                onClick={() => setRegenerateOpen(true)}
                disabled={regenerating}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Regenerate link
              </Button>
            </>
          ) : (
            <Button type="button" onClick={() => loadFeed()} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading…
                </>
              ) : (
                "Create subscription link"
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={regenerateOpen} onOpenChange={setRegenerateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate calendar link?</DialogTitle>
            <DialogDescription>
              Your current subscription will stop updating on devices that still
              use the old URL. You will need to add the new link on each device.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRegenerateOpen(false)}
              disabled={regenerating}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => regenerateFeed()}
              disabled={regenerating}
            >
              {regenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Regenerating…
                </>
              ) : (
                "Regenerate"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

const CopyRow = ({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          onClick={onCopy}
          className="h-auto w-full justify-between gap-2 whitespace-normal px-3 py-2 text-left font-normal"
        >
          <span className="min-w-0 flex-1">
            <span className="mb-1 block text-xs text-muted-foreground">
              {label}
            </span>
            <span className="block break-all text-sm">{value}</span>
          </span>
          <Copy className="h-4 w-4 shrink-0" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{copied ? "Copied!" : "Copy"}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);
