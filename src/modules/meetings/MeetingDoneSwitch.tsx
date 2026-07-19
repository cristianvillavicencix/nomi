import { useUpdate, useNotify } from "ra-core";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { CalendarEventRecord } from "@/components/atomic-crm/types";

export const MeetingDoneSwitch = ({
  meeting,
}: {
  meeting: CalendarEventRecord;
}) => {
  const [update, { isPending }] = useUpdate();
  const notify = useNotify();
  const isDone = Boolean(meeting.completed_at);

  const handleChange = async (checked: boolean) => {
    try {
      await update(
        "calendar_events",
        {
          id: meeting.id,
          data: {
            completed_at: checked ? new Date().toISOString() : null,
          },
          previousData: meeting,
        },
        { returnPromise: true },
      );
    } catch {
      notify("Failed to update meeting", { type: "error" });
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex justify-center">
            <Switch
              checked={isDone}
              disabled={isPending}
              onCheckedChange={handleChange}
              aria-label={
                isDone ? "Mark meeting as not done" : "Mark meeting as done"
              }
            />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {isDone ? "Meeting done" : "Mark as done"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

/** One-shot action to mark a past meeting complete (no undo switch). */
export const MarkMeetingDoneButton = ({
  meeting,
}: {
  meeting: CalendarEventRecord;
}) => {
  const [update, { isPending }] = useUpdate();
  const notify = useNotify();

  if (meeting.completed_at) return null;

  const handleMarkDone = async () => {
    try {
      await update(
        "calendar_events",
        {
          id: meeting.id,
          data: { completed_at: new Date().toISOString() },
          previousData: meeting,
        },
        { returnPromise: true },
      );
    } catch {
      notify("Failed to update meeting", { type: "error" });
    }
  };

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={isPending}
      onClick={() => void handleMarkDone()}
      aria-label="Mark meeting as done"
    >
      Mark done
    </Button>
  );
};
