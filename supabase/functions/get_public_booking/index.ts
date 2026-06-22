import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import {
  listBookableDates,
  normalizeBookingSettings,
  normalizeSlotTime,
  parseDateKey,
  canRescheduleBooking,
  isUpcomingBooking,
} from "../_shared/bookingUtils.ts";

const jsonCorsHeaders = {
  ...corsHeaders,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const loadToken = async (token: string) => {
  const { data, error } = await supabaseAdmin
    .from("public_booking_tokens")
    .select(
      `
      id,
      org_id,
      expires_at,
      organization_member_id,
      contact_id,
      company_id,
      deal_id
    `,
    )
    .eq("token", token)
    .maybeSingle();

  if (error || !data) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
  return data;
};

const loadServices = async (orgId: number) => {
  const { data: packages = [] } = await supabaseAdmin
    .from("service_packages")
    .select(
      "id, name, description, suggested_price, billing_type, currency, category, sort_order",
    )
    .eq("org_id", orgId)
    .eq("active", true)
    .eq("booking_enabled", true)
    .order("sort_order", { ascending: true })
    .limit(12);

  if (packages.length > 0) {
    return packages.map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      description: pkg.description,
      category: pkg.category,
    }));
  }

  return [
    {
      id: null,
      name: "Website",
      description: "Custom website project consultation",
      category: "web",
    },
    {
      id: null,
      name: "Google Ads",
      description: "Paid search and lead generation",
      category: "marketing",
    },
    {
      id: null,
      name: "Local SEO",
      description: "Maps and local search visibility",
      category: "marketing",
    },
  ];
};

const loadBookedSlots = async (
  orgId: number,
  memberId: number | null,
  eventDate: string,
  excludeCalendarEventId?: number | null,
) => {
  let query = supabaseAdmin
    .from("calendar_events")
    .select("id, event_time")
    .eq("org_id", orgId)
    .eq("event_date", eventDate)
    .is("completed_at", null);

  if (memberId != null) {
    query = query.eq("organization_member_id", memberId);
  }

  const { data = [] } = await query;
  return new Set(
    data
      .filter((row) => {
        if (excludeCalendarEventId == null) return true;
        return row.id !== excludeCalendarEventId;
      })
      .map((row) => String(row.event_time ?? "").slice(0, 5))
      .filter(Boolean),
  );
};

const isUpcomingBookingLocal = isUpcomingBooking;

const loadExistingBooking = async (
  tokenId: number,
  cutoffMinutes: number,
) => {
  const { data } = await supabaseAdmin
    .from("public_bookings")
    .select(
      "id, service_name, service_package_id, event_date, event_time, guest_name, guest_company, guest_phone, guest_email, calendar_event_id",
    )
    .eq("booking_token_id", tokenId)
    .eq("status", "confirmed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  if (!isUpcomingBookingLocal(data.event_date, data.event_time)) return null;

  const eventTime = String(data.event_time ?? "").slice(0, 5);

  return {
    id: data.id,
    service_name: data.service_name,
    service_package_id: data.service_package_id,
    event_date: data.event_date,
    event_time: eventTime,
    guest_name: data.guest_name,
    guest_company: data.guest_company,
    guest_phone: data.guest_phone,
    guest_email: data.guest_email,
    calendar_event_id: data.calendar_event_id,
    can_reschedule: canRescheduleBooking(
      data.event_date,
      eventTime,
      cutoffMinutes,
    ),
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: jsonCorsHeaders });
  }

  if (req.method === "GET") {
    const url = new URL(req.url);
    const code = String(url.searchParams.get("code") ?? "").trim();
    if (!code) {
      return createErrorResponse(400, "Missing short code");
    }

    const { data, error } = await supabaseAdmin
      .from("public_booking_tokens")
      .select("token, expires_at")
      .eq("short_code", code)
      .maybeSingle();

    if (error || !data?.token) {
      return createErrorResponse(404, "Short link not found");
    }
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return createErrorResponse(410, "This booking link has expired");
    }

    return new Response(JSON.stringify({ token: data.token }), {
      headers: { ...jsonCorsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return createErrorResponse(405, "Method not allowed");
  }

  try {
    const body = (await req.json()) as { token?: string; date?: string };
    const token = String(body.token ?? "").trim();
    if (!token) {
      return createErrorResponse(400, "Missing booking token");
    }

    const tokenData = await loadToken(token);
    if (!tokenData) {
      return createErrorResponse(404, "Invalid or expired booking link");
    }

    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("id, name, booking_settings")
      .eq("id", tokenData.org_id)
      .maybeSingle();

    if (!org?.id) {
      return createErrorResponse(404, "Organization not found");
    }

    const settings = normalizeBookingSettings(org.booking_settings);
    if (!settings.enabled) {
      return createErrorResponse(404, "Booking is not available");
    }

    let hostName: string | null = null;
    let hostPhone: string | null = null;
    if (tokenData.organization_member_id != null) {
      const { data: host } = await supabaseAdmin
        .from("organization_members")
        .select("first_name, last_name, notification_phone")
        .eq("id", tokenData.organization_member_id)
        .maybeSingle();
      const parts = [host?.first_name, host?.last_name]
        .map((part) => String(part ?? "").trim())
        .filter(Boolean);
      hostName = parts.length > 0 ? parts.join(" ") : null;
      hostPhone = host?.notification_phone
        ? String(host.notification_phone).trim()
        : null;
    }

    const existingBooking = await loadExistingBooking(
      tokenData.id,
      settings.reschedule_cutoff_minutes,
    );

    const requestedDate = body.date ? String(body.date).trim() : "";
    if (requestedDate) {
      const parsed = parseDateKey(requestedDate);
      if (!parsed) {
        return createErrorResponse(400, "Invalid date");
      }

      const booked = await loadBookedSlots(
        tokenData.org_id,
        tokenData.organization_member_id,
        requestedDate,
        existingBooking?.calendar_event_id ?? null,
      );

      const slots = settings.slot_times
        .map((slot) => normalizeSlotTime(slot))
        .filter((slot): slot is string => Boolean(slot))
        .filter((slot) => !booked.has(slot));

      if (
        existingBooking &&
        existingBooking.event_date === requestedDate &&
        existingBooking.event_time &&
        !slots.includes(existingBooking.event_time)
      ) {
        slots.push(existingBooking.event_time);
        slots.sort();
      }

      return new Response(
        JSON.stringify({
          date: requestedDate,
          slots,
        }),
        { headers: { ...jsonCorsHeaders, "Content-Type": "application/json" } },
      );
    }

    const services = await loadServices(tokenData.org_id);
    const dates = listBookableDates(settings.booking_horizon_days);

    let prefill: Record<string, string> = {};
    if (tokenData.contact_id) {
      const { data: contact } = await supabaseAdmin
        .from("contacts")
        .select("first_name, last_name, email_jsonb, phone_jsonb, company_id")
        .eq("id", tokenData.contact_id)
        .maybeSingle();

      if (contact) {
        const email = Array.isArray(contact.email_jsonb)
          ? contact.email_jsonb[0]?.email
          : null;
        const phone = Array.isArray(contact.phone_jsonb)
          ? contact.phone_jsonb[0]?.number
          : null;
        prefill = {
          name: [contact.first_name, contact.last_name]
            .map((part) => String(part ?? "").trim())
            .filter(Boolean)
            .join(" "),
          email: email ? String(email) : "",
          phone: phone ? String(phone) : "",
        };

        const companyId = tokenData.company_id ?? contact.company_id;
        if (companyId) {
          const { data: company } = await supabaseAdmin
            .from("companies")
            .select("name")
            .eq("id", companyId)
            .maybeSingle();
          if (company?.name) {
            prefill.company = String(company.name);
          }
        }
      }
    }

    if (existingBooking && Object.keys(prefill).length === 0) {
      prefill = {
        name: String(existingBooking.guest_name ?? ""),
        company: String(existingBooking.guest_company ?? ""),
        phone: String(existingBooking.guest_phone ?? ""),
        email: String(existingBooking.guest_email ?? ""),
      };
    }

    return new Response(
      JSON.stringify({
        token,
        org: {
          id: org.id,
          name: org.name,
          page_title: settings.page_title,
          timezone_label: settings.timezone_label,
        },
        host_name: hostName,
        host_phone: hostPhone,
        services,
        settings: {
          duration_minutes: settings.duration_minutes,
          slot_times: settings.slot_times,
          reschedule_cutoff_minutes: settings.reschedule_cutoff_minutes,
        },
        dates,
        prefill,
        existing_booking: existingBooking,
        links: {
          contact_id: tokenData.contact_id,
          company_id: tokenData.company_id,
          deal_id: tokenData.deal_id,
        },
      }),
      { headers: { ...jsonCorsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[get_public_booking] error", error);
    return createErrorResponse(
      500,
      error instanceof Error ? error.message : "Unexpected error",
    );
  }
});
