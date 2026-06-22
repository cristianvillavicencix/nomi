import { CalendarClock, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  formatBookingDateLabel,
  formatBookingTimeLabel,
} from "@/modules/booking/bookingFormatUtils";
import { BookingAddToCalendar } from "@/modules/booking/public/BookingAddToCalendar";
import { formatUsPhoneDisplayFromAny } from "@/utils/phone";

type ExistingBookingViewProps = {
  orgName: string;
  hostName?: string | null;
  hostPhone?: string | null;
  durationMinutes: number;
  rescheduleCutoffMinutes: number;
  booking: {
    service_name: string;
    event_date: string;
    event_time: string;
    guest_name: string;
    guest_company?: string | null;
    can_reschedule: boolean;
  };
  onReschedule: () => void;
};

export const ExistingBookingView = ({
  orgName,
  hostName,
  hostPhone,
  durationMinutes,
  rescheduleCutoffMinutes,
  booking,
  onReschedule,
}: ExistingBookingViewProps) => {
  const hostLabel = hostName?.trim() || orgName;
  const phoneDisplay = hostPhone
    ? formatUsPhoneDisplayFromAny(hostPhone)
    : null;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CalendarClock className="size-7" />
        </div>
        <h1 className="mt-4 text-center text-2xl font-semibold">
          Your meeting is scheduled
        </h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          You already have a booking on this link.
        </p>

        <div className="mt-6 rounded-xl bg-muted/50 p-4 text-sm">
          <p>
            <span className="text-muted-foreground">Service:</span>{" "}
            {booking.service_name}
          </p>
          <p className="mt-2">
            <span className="text-muted-foreground">When:</span>{" "}
            {formatBookingDateLabel(booking.event_date)},{" "}
            {formatBookingTimeLabel(booking.event_time)}
          </p>
          {hostName ? (
            <p className="mt-2">
              <span className="text-muted-foreground">With:</span> {hostName}
            </p>
          ) : null}
          <p className="mt-2">
            <span className="text-muted-foreground">Name:</span>{" "}
            {booking.guest_name}
          </p>
          {booking.guest_company ? (
            <p className="mt-2">
              <span className="text-muted-foreground">Company:</span>{" "}
              {booking.guest_company}
            </p>
          ) : null}
        </div>

        <BookingAddToCalendar
          event={{
            title: `${booking.service_name} with ${orgName}`,
            date: booking.event_date,
            time: booking.event_time,
            durationMinutes,
            description: `Meeting with ${hostLabel}`,
          }}
        />

        {booking.can_reschedule ? (
          <Button type="button" className="mt-6 w-full" onClick={onReschedule}>
            Reschedule
          </Button>
        ) : (
          <div className="mt-6 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900/50 dark:bg-amber-950/30">
            <p className="font-medium">Rescheduling is not available online</p>
            <p className="text-muted-foreground">
              Online changes close {rescheduleCutoffMinutes} minutes before your
              meeting. Please contact {hostLabel} directly.
            </p>
            {hostPhone ? (
              <Button type="button" className="w-full" asChild>
                <a href={`tel:${hostPhone}`}>
                  <Phone className="mr-2 size-4" />
                  Call {phoneDisplay ?? hostLabel}
                </a>
              </Button>
            ) : (
              <p className="text-muted-foreground">
                Ask {hostLabel} for their direct phone number.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
