import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useDataProvider } from "ra-core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { cn } from "@/lib/utils";
import {
  formatBookingDateLabel,
  formatBookingDateLong,
  formatBookingTimeLabel,
} from "@/modules/booking/bookingFormatUtils";
import { BookingAddToCalendar } from "@/modules/booking/public/BookingAddToCalendar";
import { BookingDatePicker } from "@/modules/booking/public/BookingDatePicker";
import { ExistingBookingView } from "@/modules/booking/public/ExistingBookingView";
import {
  BookingServicePicker,
  type BookingServiceOption,
} from "@/modules/booking/public/BookingServicePicker";

type BookingPayload = Awaited<ReturnType<CrmDataProvider["getPublicBooking"]>>;

const STEP_LABELS = ["Service", "Date & time", "Your details", "Confirm"];

const parseDateKeyToLocal = (dateKey: string) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const findServiceOption = (
  services: BookingServiceOption[],
  existing: {
    service_name: string;
    service_package_id: number | null;
  },
) => {
  const byId = services.find(
    (service) =>
      existing.service_package_id != null &&
      service.id === existing.service_package_id,
  );
  if (byId) return byId;
  return (
    services.find((service) => service.name === existing.service_name) ?? {
      id: existing.service_package_id,
      name: existing.service_name,
    }
  );
};

export const PublicBookingPage = () => {
  const { token = "" } = useParams();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [step, setStep] = useState(0);
  const [selectedService, setSelectedService] =
    useState<BookingServiceOption | null>(null);
  const [monthAnchor, setMonthAnchor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [guest, setGuest] = useState({
    name: "",
    company: "",
    phone: "",
    email: "",
  });
  const [submitted, setSubmitted] = useState<{
    service_name: string;
    event_date: string;
    event_time: string;
    host_name?: string | null;
    rescheduled?: boolean;
  } | null>(null);
  const [rescheduleBookingId, setRescheduleBookingId] = useState<number | null>(
    null,
  );
  const [flow, setFlow] = useState<"existing" | "wizard">("wizard");

  const {
    data: payload,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["public-booking", token],
    enabled: Boolean(token),
    queryFn: () => dataProvider.getPublicBooking({ token }),
  });

  const { data: slotsPayload, isFetching: slotsLoading } = useQuery({
    queryKey: ["public-booking-slots", token, selectedDate],
    enabled: Boolean(token && selectedDate),
    queryFn: () =>
      dataProvider.getPublicBookingSlots({ token, date: selectedDate }),
  });

  const submitMutation = useMutation({
    mutationFn: () => {
      if (!selectedService || !selectedDate || !selectedTime) {
        throw new Error("Complete all booking steps");
      }
      return dataProvider.submitPublicBooking({
        token,
        rescheduleBookingId,
        servicePackageId: selectedService.id,
        serviceName: selectedService.name,
        eventDate: selectedDate,
        eventTime: selectedTime,
        guest,
      });
    },
    onSuccess: (result) => {
      if (result.confirmation) {
        setSubmitted({
          ...result.confirmation,
          rescheduled: result.rescheduled,
        });
        setStep(3);
      }
    },
  });

  const booking = payload as BookingPayload | undefined;
  const existingBooking = booking?.existing_booking ?? null;

  const startReschedule = () => {
    if (!existingBooking?.can_reschedule || !booking) return;
    setRescheduleBookingId(existingBooking.id);
    setSelectedService(findServiceOption(booking.services, existingBooking));
    setSelectedDate(existingBooking.event_date);
    setSelectedTime(existingBooking.event_time);
    setMonthAnchor(parseDateKeyToLocal(existingBooking.event_date));
    setGuest({
      name: existingBooking.guest_name ?? "",
      company: existingBooking.guest_company ?? "",
      phone: existingBooking.guest_phone ?? "",
      email: existingBooking.guest_email ?? "",
    });
    setFlow("wizard");
    setStep(1);
  };

  useEffect(() => {
    if (!existingBooking || !booking) return;
    if (!rescheduleBookingId) {
      setFlow("existing");
    }
    setSelectedService(findServiceOption(booking.services, existingBooking));
    setGuest({
      name: existingBooking.guest_name ?? "",
      company: existingBooking.guest_company ?? "",
      phone: existingBooking.guest_phone ?? "",
      email: existingBooking.guest_email ?? "",
    });
  }, [existingBooking, booking, rescheduleBookingId]);

  useEffect(() => {
    if (!booking?.prefill) return;
    setGuest((current) => ({
      name: current.name || booking.prefill?.name || "",
      company: current.company || booking.prefill?.company || "",
      phone: current.phone || booking.prefill?.phone || "",
      email: current.email || booking.prefill?.email || "",
    }));
  }, [booking?.prefill]);

  useEffect(() => {
    const first = booking?.dates?.[0];
    if (first) {
      setMonthAnchor(parseDateKeyToLocal(first));
    }
  }, [booking?.dates]);

  const bookableDates = booking?.dates ?? [];
  const availableSlots = slotsPayload?.slots ?? [];

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-muted/30 p-6">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg items-center p-6">
        <div>
          <h1 className="text-xl font-semibold">Booking unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error instanceof Error
              ? error.message
              : "This link is invalid or has expired."}
          </p>
        </div>
      </div>
    );
  }

  if (existingBooking && flow === "existing") {
    return (
      <ExistingBookingView
        orgName={booking.org.name}
        hostName={booking.host_name}
        hostPhone={booking.host_phone}
        durationMinutes={booking.settings.duration_minutes}
        rescheduleCutoffMinutes={booking.settings.reschedule_cutoff_minutes}
        booking={existingBooking}
        onReschedule={startReschedule}
      />
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
        <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Check className="size-7" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold">
            {submitted.rescheduled ? "You're rescheduled!" : "You're booked!"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            We sent a confirmation message if a phone number was provided.
          </p>
          <div className="mt-6 rounded-xl bg-muted/50 p-4 text-left text-sm">
            <p>
              <span className="text-muted-foreground">Service:</span>{" "}
              {submitted.service_name}
            </p>
            <p className="mt-2">
              <span className="text-muted-foreground">When:</span>{" "}
              {formatBookingDateLabel(submitted.event_date)},{" "}
              {formatBookingTimeLabel(submitted.event_time)}
            </p>
            {submitted.host_name ? (
              <p className="mt-2">
                <span className="text-muted-foreground">With:</span>{" "}
                {submitted.host_name}
              </p>
            ) : null}
          </div>
          <BookingAddToCalendar
            event={{
              title: `${submitted.service_name} with ${booking.org.name}`,
              date: submitted.event_date,
              time: submitted.event_time,
              durationMinutes: booking.settings.duration_minutes,
              description: `Booked with ${submitted.host_name ?? booking.org.name}`,
            }}
          />
        </div>
      </div>
    );
  }

  const progress = ((step + 1) / STEP_LABELS.length) * 100;

  const canContinue =
    (step === 0 && selectedService != null) ||
    (step === 1 && selectedDate && selectedTime) ||
    (step === 2 &&
      guest.name.trim() &&
      (guest.phone.trim() || guest.email.trim()));

  const sidebar = (
    <aside className="hidden rounded-2xl border bg-card p-6 lg:block">
      <p className="text-sm font-medium text-muted-foreground">
        Book in 4 steps
      </p>
      <ol className="mt-6 space-y-4">
        {STEP_LABELS.map((label, index) => {
          const done = index < step;
          const active = index === step;
          return (
            <li key={label} className="flex items-start gap-3">
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-medium",
                  done && "bg-emerald-100 text-emerald-700",
                  active && !done && "bg-primary text-primary-foreground",
                  !done && !active && "border text-muted-foreground",
                )}
              >
                {done ? <Check className="size-4" /> : index + 1}
              </div>
              <div>
                <p className="font-medium">{label}</p>
                {active ? (
                  <p className="text-xs text-muted-foreground">In progress</p>
                ) : done && index === 0 && selectedService ? (
                  <p className="text-xs text-muted-foreground">
                    {selectedService.name}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </aside>
  );

  return (
    <div className="min-h-dvh bg-muted/30 px-4 py-8">
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[280px_1fr]">
        {sidebar}
        <div className="rounded-2xl border bg-card shadow-sm">
          <div className="border-b px-6 py-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Step {step + 1} of {STEP_LABELS.length}
            </p>
            <h1 className="mt-1 text-2xl font-semibold">
              {booking.org.page_title || `Schedule with ${booking.org.name}`}
            </h1>
            {booking.host_name ? (
              <p className="mt-1 text-sm text-foreground">
                Meeting with{" "}
                <span className="font-medium">{booking.host_name}</span>
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                {booking.org.name}
              </p>
            )}
            <Progress value={progress} className="mt-4 h-1.5" />
          </div>

          <div className="px-6 py-6">
            {step === 0 ? (
              <div className="space-y-3">
                <div>
                  <h2 className="text-lg font-medium">Choose a service</h2>
                </div>
                <BookingServicePicker
                  services={booking.services}
                  selected={selectedService}
                  onSelect={setSelectedService}
                />
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-medium">Choose date and time</h2>
                  <p className="text-sm text-muted-foreground">
                    Timezone: {booking.org.timezone_label}
                  </p>
                </div>
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px]">
                  <BookingDatePicker
                    monthAnchor={monthAnchor}
                    onMonthChange={setMonthAnchor}
                    bookableDates={bookableDates}
                    selectedDate={selectedDate}
                    onSelectDate={(dateKey) => {
                      setSelectedDate(dateKey);
                      setSelectedTime("");
                    }}
                  />
                  <div>
                    <p className="mb-3 text-sm font-medium">
                      {selectedDate
                        ? formatBookingDateLong(selectedDate)
                        : "Available times"}
                    </p>
                    <div className="space-y-2">
                      {!selectedDate ? (
                        <p className="text-sm text-muted-foreground">
                          Pick a date on the calendar.
                        </p>
                      ) : slotsLoading ? (
                        <Loader2 className="size-5 animate-spin text-muted-foreground" />
                      ) : (
                        availableSlots.map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setSelectedTime(slot)}
                            className={cn(
                              "w-full rounded-xl border px-4 py-2.5 text-sm font-medium",
                              selectedTime === slot
                                ? "border-primary bg-primary/5"
                                : "hover:bg-muted/40",
                            )}
                          >
                            {formatBookingTimeLabel(slot)}
                          </button>
                        ))
                      )}
                      {selectedDate &&
                      !slotsLoading &&
                      availableSlots.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No open slots on this day.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="mx-auto max-w-md space-y-4">
                <h2 className="text-lg font-medium">Your details</h2>
                <div className="space-y-2">
                  <Label htmlFor="booking-name">Name</Label>
                  <Input
                    id="booking-name"
                    value={guest.name}
                    onChange={(event) =>
                      setGuest((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="booking-company">Company</Label>
                  <Input
                    id="booking-company"
                    value={guest.company}
                    onChange={(event) =>
                      setGuest((current) => ({
                        ...current,
                        company: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="booking-phone">Phone</Label>
                  <Input
                    id="booking-phone"
                    value={guest.phone}
                    onChange={(event) =>
                      setGuest((current) => ({
                        ...current,
                        phone: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="booking-email">Email</Label>
                  <Input
                    id="booking-email"
                    type="email"
                    value={guest.email}
                    onChange={(event) =>
                      setGuest((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            ) : null}

            {step === 3 && selectedService ? (
              <div className="mx-auto max-w-md space-y-4">
                <h2 className="text-lg font-medium">Review and confirm</h2>
                <div className="rounded-xl bg-muted/40 p-4 text-sm">
                  <p>
                    <span className="text-muted-foreground">Service:</span>{" "}
                    {selectedService.name}
                  </p>
                  <p className="mt-2">
                    <span className="text-muted-foreground">When:</span>{" "}
                    {formatBookingDateLabel(selectedDate)},{" "}
                    {formatBookingTimeLabel(selectedTime)}
                  </p>
                  {booking.host_name ? (
                    <p className="mt-2">
                      <span className="text-muted-foreground">With:</span>{" "}
                      {booking.host_name}
                    </p>
                  ) : null}
                  <p className="mt-2">
                    <span className="text-muted-foreground">Name:</span>{" "}
                    {guest.name}
                  </p>
                  {guest.company ? (
                    <p className="mt-2">
                      <span className="text-muted-foreground">Company:</span>{" "}
                      {guest.company}
                    </p>
                  ) : null}
                </div>
                {submitMutation.error ? (
                  <p className="text-sm text-destructive">
                    {submitMutation.error instanceof Error
                      ? submitMutation.error.message
                      : "Could not confirm booking"}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between border-t px-6 py-4">
            <Button
              type="button"
              variant="outline"
              disabled={step === 0 || submitMutation.isPending}
              onClick={() => {
                if (step === 1 && rescheduleBookingId) {
                  setFlow("existing");
                  setRescheduleBookingId(null);
                  setStep(0);
                  return;
                }
                setStep((current) => Math.max(0, current - 1));
              }}
            >
              <ChevronLeft className="mr-1 size-4" />
              Back
            </Button>
            {step < 3 ? (
              <Button
                type="button"
                disabled={!canContinue}
                onClick={() => setStep((current) => current + 1)}
              >
                Continue
                <ChevronRight className="ml-1 size-4" />
              </Button>
            ) : (
              <Button
                type="button"
                disabled={submitMutation.isPending}
                onClick={() => submitMutation.mutate()}
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    {rescheduleBookingId ? "Rescheduling…" : "Confirming…"}
                  </>
                ) : rescheduleBookingId ? (
                  "Confirm reschedule"
                ) : (
                  "Confirm booking"
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
