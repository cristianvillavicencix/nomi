import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import {
  normalizeBookingSettings,
  normalizeSlotTime,
  parseDateKey,
  slotTimeToDb,
  canRescheduleBooking,
  isUpcomingBooking,
} from "../_shared/bookingUtils.ts";
import { notifyFollowUpForCalendarEvent } from "../_shared/notifyFollowUp.ts";

type SubmitBookingBody = {
  token?: string;
  reschedule_booking_id?: number | null;
  service_package_id?: number | null;
  service_name?: string;
  event_date?: string;
  event_time?: string;
  guest?: {
    name?: string;
    company?: string;
    phone?: string;
    email?: string;
  };
  app_base_url?: string | null;
};

const splitName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: "Guest", last_name: "" };
  if (parts.length === 1) return { first_name: parts[0], last_name: "" };
  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(" "),
  };
};

Deno.serve(
  OptionsMiddleware(async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    try {
      const body = (await req.json()) as SubmitBookingBody;
      const token = String(body.token ?? "").trim();
      const eventDate = String(body.event_date ?? "").trim();
      const eventTime = normalizeSlotTime(String(body.event_time ?? ""));
      const guestName = String(body.guest?.name ?? "").trim();
      const guestCompany = String(body.guest?.company ?? "").trim();
      const guestPhone = String(body.guest?.phone ?? "").trim();
      const guestEmail = String(body.guest?.email ?? "").trim();
      const serviceName = String(body.service_name ?? "").trim();

      if (!token) return createErrorResponse(400, "Missing booking token");
      if (!guestName) return createErrorResponse(400, "Name is required");
      if (!guestPhone && !guestEmail) {
        return createErrorResponse(400, "Phone or email is required");
      }
      if (!parseDateKey(eventDate)) {
        return createErrorResponse(400, "Invalid event date");
      }
      if (!eventTime) {
        return createErrorResponse(400, "Invalid event time");
      }
      if (!serviceName) {
        return createErrorResponse(400, "Service is required");
      }

      const { data: tokenData, error: tokenError } = await supabaseAdmin
        .from("public_booking_tokens")
        .select(
          "id, org_id, expires_at, organization_member_id, contact_id, company_id, deal_id",
        )
        .eq("token", token)
        .maybeSingle();

      if (tokenError || !tokenData) {
        return createErrorResponse(404, "Invalid or expired booking link");
      }
      if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
        return createErrorResponse(410, "This booking link has expired");
      }

      const { data: org } = await supabaseAdmin
        .from("organizations")
        .select("booking_settings")
        .eq("id", tokenData.org_id)
        .maybeSingle();

      const settings = normalizeBookingSettings(org?.booking_settings);
      if (!settings.enabled) {
        return createErrorResponse(404, "Booking is not available");
      }

      const allowedSlots = settings.slot_times
        .map((slot) => normalizeSlotTime(slot))
        .filter((slot): slot is string => Boolean(slot));

      if (!allowedSlots.includes(eventTime)) {
        return createErrorResponse(400, "Time slot is not available");
      }

      const dbTime = slotTimeToDb(eventTime);
      if (!dbTime) {
        return createErrorResponse(400, "Invalid event time");
      }

      const rescheduleBookingId = Number(body.reschedule_booking_id);
      const isReschedule = Number.isFinite(rescheduleBookingId);

      let rescheduleBooking: {
        id: number;
        calendar_event_id: number | null;
        contact_id: number | null;
      } | null = null;

      if (isReschedule) {
        const { data: existingBooking } = await supabaseAdmin
          .from("public_bookings")
          .select(
            "id, calendar_event_id, contact_id, status, event_date, event_time",
          )
          .eq("id", rescheduleBookingId)
          .eq("booking_token_id", tokenData.id)
          .eq("status", "confirmed")
          .maybeSingle();

        if (!existingBooking?.id) {
          return createErrorResponse(404, "Booking not found for reschedule");
        }

        const existingTime = String(existingBooking.event_time ?? "").slice(0, 5);
        if (
          !canRescheduleBooking(
            existingBooking.event_date,
            existingTime,
            settings.reschedule_cutoff_minutes,
          )
        ) {
          return createErrorResponse(
            403,
            "Rescheduling is not available this close to your meeting. Please contact your host directly.",
          );
        }

        rescheduleBooking = existingBooking;
      } else {
        const { data: activeBooking } = await supabaseAdmin
          .from("public_bookings")
          .select("id, event_date, event_time")
          .eq("booking_token_id", tokenData.id)
          .eq("status", "confirmed")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (
          activeBooking &&
          isUpcomingBooking(activeBooking.event_date, activeBooking.event_time)
        ) {
          return createErrorResponse(
            409,
            "You already have a booking on this link.",
          );
        }
      }

      let slotQuery = supabaseAdmin
        .from("calendar_events")
        .select("id")
        .eq("org_id", tokenData.org_id)
        .eq("event_date", eventDate)
        .eq("event_time", dbTime)
        .is("completed_at", null)
        .limit(1);

      if (tokenData.organization_member_id != null) {
        slotQuery = slotQuery.eq(
          "organization_member_id",
          tokenData.organization_member_id,
        );
      }

      const { data: existingSlot } = await slotQuery.maybeSingle();
      const rescheduleEventId = rescheduleBooking?.calendar_event_id ?? null;
      if (existingSlot?.id && existingSlot.id !== rescheduleEventId) {
        return createErrorResponse(409, "That time slot is no longer available");
      }

      let contactId = tokenData.contact_id ?? rescheduleBooking?.contact_id ?? null;
      if (!contactId) {
        const { first_name, last_name } = splitName(guestName);
        const { data: createdContact, error: contactError } = await supabaseAdmin
          .from("contacts")
          .insert({
            org_id: tokenData.org_id,
            first_name,
            last_name,
            status: "lead",
            lead_stage: "new",
            lead_source: "Otro",
            lead_source_other: "Book Now",
            company_id: tokenData.company_id,
            phone_jsonb: guestPhone
              ? [{ number: guestPhone, type: "Mobile" }]
              : [],
            email_jsonb: guestEmail
              ? [{ email: guestEmail, type: "Work" }]
              : [],
            organization_member_id: tokenData.organization_member_id,
            first_seen: new Date().toISOString(),
            last_seen: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (contactError || !createdContact?.id) {
          console.error("[submit_public_booking] contact insert", contactError);
        } else {
          contactId = createdContact.id;
        }
      }

      const description = [
        `Service: ${serviceName}`,
        guestCompany ? `Company: ${guestCompany}` : null,
        guestPhone ? `Phone: ${guestPhone}` : null,
        guestEmail ? `Email: ${guestEmail}` : null,
        isReschedule ? "Source: Public booking (rescheduled)" : "Source: Public booking",
      ]
        .filter(Boolean)
        .join("\n");

      const calendarPayload = {
        title: `Booking: ${serviceName} — ${guestName}`,
        event_date: eventDate,
        event_time: dbTime,
        duration_minutes: settings.duration_minutes,
        remind_before_minutes: 15,
        description,
        deal_id: tokenData.deal_id,
        contact_id: contactId,
        company_id: tokenData.company_id,
        organization_member_id: tokenData.organization_member_id,
      };

      let calendarEventId: number;

      if (isReschedule && rescheduleEventId) {
        const { data: updatedEvent, error: calendarError } = await supabaseAdmin
          .from("calendar_events")
          .update(calendarPayload)
          .eq("id", rescheduleEventId)
          .eq("org_id", tokenData.org_id)
          .select("id")
          .single();

        if (calendarError || !updatedEvent?.id) {
          console.error("[submit_public_booking] calendar update", calendarError);
          return createErrorResponse(500, "Could not update calendar event");
        }
        calendarEventId = updatedEvent.id;
      } else {
        const { data: calendarEvent, error: calendarError } = await supabaseAdmin
          .from("calendar_events")
          .insert({
            org_id: tokenData.org_id,
            ...calendarPayload,
          })
          .select("id")
          .single();

        if (calendarError || !calendarEvent?.id) {
          console.error("[submit_public_booking] calendar insert", calendarError);
          return createErrorResponse(500, "Could not create calendar event");
        }
        calendarEventId = calendarEvent.id;
      }

      const packageId = Number(body.service_package_id);
      let bookingId: number | null = null;

      if (isReschedule && rescheduleBooking) {
        const { data: updatedBooking, error: bookingError } = await supabaseAdmin
          .from("public_bookings")
          .update({
            service_package_id: Number.isFinite(packageId) ? packageId : null,
            service_name: serviceName,
            contact_id: contactId,
            calendar_event_id: calendarEventId,
            guest_name: guestName,
            guest_company: guestCompany || null,
            guest_phone: guestPhone || null,
            guest_email: guestEmail || null,
            event_date: eventDate,
            event_time: dbTime,
          })
          .eq("id", rescheduleBooking.id)
          .select("id")
          .single();

        if (bookingError) {
          console.error("[submit_public_booking] booking update", bookingError);
        } else {
          bookingId = updatedBooking?.id ?? rescheduleBooking.id;
        }
      } else {
        const { data: booking, error: bookingError } = await supabaseAdmin
          .from("public_bookings")
          .insert({
            org_id: tokenData.org_id,
            booking_token_id: tokenData.id,
            service_package_id: Number.isFinite(packageId) ? packageId : null,
            service_name: serviceName,
            organization_member_id: tokenData.organization_member_id,
            contact_id: contactId,
            calendar_event_id: calendarEventId,
            guest_name: guestName,
            guest_company: guestCompany || null,
            guest_phone: guestPhone || null,
            guest_email: guestEmail || null,
            event_date: eventDate,
            event_time: dbTime,
          })
          .select("id")
          .single();

        if (bookingError) {
          console.error("[submit_public_booking] booking insert", bookingError);
        } else {
          bookingId = booking?.id ?? null;
        }
      }

      try {
        await notifyFollowUpForCalendarEvent(
          supabaseAdmin,
          calendarEventId,
          "scheduled",
          { appBaseUrl: body.app_base_url ?? null },
        );
      } catch (notifyError) {
        console.warn("[submit_public_booking] notify failed", notifyError);
      }

      let hostName: string | null = null;
      if (tokenData.organization_member_id != null) {
        const { data: host } = await supabaseAdmin
          .from("organization_members")
          .select("first_name, last_name")
          .eq("id", tokenData.organization_member_id)
          .maybeSingle();
        const parts = [host?.first_name, host?.last_name]
          .map((part) => String(part ?? "").trim())
          .filter(Boolean);
        hostName = parts.length > 0 ? parts.join(" ") : null;
      }

      return new Response(
        JSON.stringify({
          ok: true,
          rescheduled: isReschedule,
          booking_id: bookingId,
          calendar_event_id: calendarEventId,
          contact_id: contactId,
          confirmation: {
            service_name: serviceName,
            event_date: eventDate,
            event_time: eventTime,
            host_name: hostName,
            guest_name: guestName,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (error) {
      console.error("[submit_public_booking] error", error);
      return createErrorResponse(
        500,
        error instanceof Error ? error.message : "Unexpected error",
      );
    }
  }),
);
