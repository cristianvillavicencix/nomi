import { useState } from "react";
import { CalendarPlus, Smartphone, TabletSmartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  openAndroidCalendar,
  openAppleCalendar,
  type BookingCalendarEventInput,
} from "@/modules/booking/bookingCalendarExport";

type BookingAddToCalendarProps = {
  event: BookingCalendarEventInput;
};

export const BookingAddToCalendar = ({ event }: BookingAddToCalendarProps) => {
  const [platform, setPlatform] = useState<"apple" | "android" | null>(null);
  const [added, setAdded] = useState(false);

  const handlePick = (next: "apple" | "android") => {
    setPlatform(next);
    if (next === "apple") {
      openAppleCalendar(event);
    } else {
      openAndroidCalendar(event);
    }
    setAdded(true);
  };

  if (added && platform) {
    return (
      <div className="mt-6 space-y-2 text-left">
        <p className="text-sm text-muted-foreground">
          {platform === "apple"
            ? "If your calendar did not open, check Downloads for booking.ics and tap it."
            : "Google Calendar should open with your meeting ready to save."}
        </p>
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() => handlePick(platform)}
        >
          <CalendarPlus className="mr-2 size-4" />
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3 text-left">
      <p className="text-sm font-medium">Add to your calendar</p>
      <p className="text-sm text-muted-foreground">Which phone do you use?</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          type="button"
          variant="secondary"
          className="h-auto justify-start px-4 py-3"
          onClick={() => handlePick("apple")}
        >
          <TabletSmartphone className="mr-2 size-4 shrink-0" />
          <span className="text-left">
            <span className="block font-medium">Apple</span>
            <span className="block text-xs text-muted-foreground">
              iPhone / iPad
            </span>
          </span>
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="h-auto justify-start px-4 py-3"
          onClick={() => handlePick("android")}
        >
          <Smartphone className="mr-2 size-4 shrink-0" />
          <span className="text-left">
            <span className="block font-medium">Android</span>
            <span className="block text-xs text-muted-foreground">
              Google Calendar
            </span>
          </span>
        </Button>
      </div>
    </div>
  );
};
