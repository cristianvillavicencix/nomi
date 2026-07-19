import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import { PRODUCT_NAME } from "@/lib/branding";
import { BrandWordmark } from "@/components/atomic-crm/layout/BrandWordmark";
import { BookingAddToCalendar } from "@/modules/booking/public/BookingAddToCalendar";
import { Button } from "@/components/ui/button";
import { Video } from "lucide-react";

type PublicCalendarEventPayload = {
  title: string;
  description?: string | null;
  event_date: string;
  event_time?: string | null;
  duration_minutes?: number | null;
  meeting_url?: string | null;
  timezone?: string | null;
  org_name?: string | null;
};

export const PublicCalendarEventPage = () => {
  const { shortCode = "", token = "" } = useParams();
  const [payload, setPayload] = useState<PublicCalendarEventPayload | null>(
    null,
  );
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const code = shortCode.trim();
    const longToken = token.trim();
    if (!code && !longToken) {
      setError(true);
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        const baseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? "").replace(
          /\/$/,
          "",
        );
        const query = code
          ? `code=${encodeURIComponent(code)}`
          : `token=${encodeURIComponent(longToken)}`;
        const response = await fetch(
          `${baseUrl}/functions/v1/get_public_calendar_event?${query}`,
          {
            headers: {
              apikey: import.meta.env.VITE_SB_PUBLISHABLE_KEY,
            },
          },
        );
        if (!response.ok) {
          setError(true);
          return;
        }
        setPayload((await response.json()) as PublicCalendarEventPayload);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [shortCode, token]);

  const calendarEvent = useMemo(() => {
    if (!payload) return null;
    const details = [
      payload.description?.trim(),
      payload.meeting_url?.trim()
        ? `Join video call: ${payload.meeting_url.trim()}`
        : null,
    ]
      .filter(Boolean)
      .join("\n\n");
    return {
      title: payload.title || "Video call",
      date: String(payload.event_date).slice(0, 10),
      time: (payload.event_time ?? "09:00").toString().slice(0, 5),
      durationMinutes: Number(payload.duration_minutes) || 60,
      description: details || undefined,
      location: payload.meeting_url?.trim() || undefined,
      timezone: payload.timezone ?? "America/New_York",
    };
  }, [payload]);

  if (loading) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center text-sm text-muted-foreground">
        Loading calendar event…
      </div>
    );
  }

  if (error || !payload || !calendarEvent) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center">
        <h1 className="text-xl font-semibold">Link not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This calendar link is invalid or has expired.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center gap-6 p-6">
      <div className="text-center">
        <BrandWordmark title={PRODUCT_NAME} className="mx-auto mb-4 text-center" />
        <p className="text-sm text-muted-foreground">
          {payload.org_name?.trim() || "Meeting"}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {payload.title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {calendarEvent.date} · {calendarEvent.time}
          {calendarEvent.durationMinutes
            ? ` · ${calendarEvent.durationMinutes} min`
            : ""}
        </p>
      </div>

      {payload.meeting_url?.trim() ? (
        <Button asChild className="w-full" size="lg">
          <a
            href={payload.meeting_url.trim()}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Video className="mr-2 size-4" />
            Join video call
          </a>
        </Button>
      ) : null}

      <BookingAddToCalendar event={calendarEvent} />
    </div>
  );
};
