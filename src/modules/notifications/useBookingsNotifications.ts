import { useCallback, useEffect, useRef } from "react";
import { format } from "date-fns";
import { useGetIdentity } from "ra-core";

import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { useNotificationPrefsContext } from "@/modules/notifications/NotificationPrefsContext";

import { getContactShowPath } from "@/app/routing";

type PublicBookingRow = {
  id: number;
  guest_name: string;
  service_name: string;
  event_date: string;
  event_time: string;
  organization_member_id: number | null;
  contact_id: number | null;
};

const buildWhenLabel = (eventDate: string, eventTime: string) => {
  const time = String(eventTime ?? "").slice(0, 5);
  const parsed = new Date(`${String(eventDate).slice(0, 10)}T${time}:00`);
  if (Number.isNaN(parsed.getTime())) return String(eventDate).slice(0, 10);
  return format(parsed, "MMM d, yyyy h:mm a");
};

const buildContactHref = (contactId: number | null) => {
  if (contactId == null) return undefined;
  return getContactShowPath(contactId);
};

export const useBookingsNotifications = () => {
  const { identity } = useGetIdentity();
  const { pushNotification } = useNotificationPrefsContext();
  const notifiedIdsRef = useRef(new Set<string>());

  const notifyBooking = useCallback(
    (booking: PublicBookingRow) => {
      const key = String(booking.id);
      if (notifiedIdsRef.current.has(key)) return;
      notifiedIdsRef.current.add(key);

      const whenLabel = buildWhenLabel(booking.event_date, booking.event_time);
      const href = buildContactHref(booking.contact_id);

      pushNotification({
        category: "bookings_new",
        title: "New booking",
        body: `${booking.guest_name} — ${booking.service_name} · ${whenLabel}`,
        tag: `booking-${booking.id}`,
        href,
        desktop: true,
        sound: true,
      });
    },
    [pushNotification],
  );

  useEffect(() => {
    if (!identity?.id) return;

    const memberId = Number(identity.id);
    if (!Number.isFinite(memberId)) return;

    const channel = supabase
      .channel(`bookings_notifications_${memberId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "public_bookings",
          filter: `organization_member_id=eq.${memberId}`,
        },
        (payload) => {
          const booking = payload.new as PublicBookingRow | undefined;
          if (!booking?.id) return;
          notifyBooking(booking);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [identity?.id, notifyBooking]);
};
