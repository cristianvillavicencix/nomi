import { invokeEdgeFunction } from "../invokeEdgeFunction";
import { invokePublicEdgeFunction } from "@/lib/supabase/invokePublicEdgeFunction";

export const bookingProvider = {
  async generateBookingLink(payload: {
    contactId?: number | null;
    companyId?: number | null;
    dealId?: number | null;
    expiresInDays?: number;
    baseUrl?: string;
    organizationMemberId?: number | null;
  }) {
    const { data, error } = await invokeEdgeFunction<{
      token: string;
      short_code?: string;
      url: string;
      short_url?: string;
      expires_at: string;
    }>("generate_booking_link", {
      method: "POST",
      body: {
        contact_id: payload.contactId ?? null,
        company_id: payload.companyId ?? null,
        deal_id: payload.dealId ?? null,
        expires_in_days: payload.expiresInDays ?? 30,
        base_url: payload.baseUrl ?? window.location.origin,
        organization_member_id: payload.organizationMemberId ?? null,
      },
    });

    if (error || !data?.token) {
      console.error("generate_booking_link.error", error);
      throw new Error("Failed to generate booking link");
    }

    return data;
  },

  async getPublicBooking(payload: { token: string; date?: string }) {
    return invokePublicEdgeFunction<{
      token: string;
      org: {
        id: number;
        name: string;
        page_title: string;
        timezone_label: string;
      };
      host_name: string | null;
      host_phone?: string | null;
      services: Array<{
        id: number | null;
        name: string;
        description?: string | null;
        category?: string | null;
      }>;
      settings: {
        duration_minutes: number;
        slot_times: string[];
        reschedule_cutoff_minutes: number;
      };
      dates: string[];
      prefill?: Record<string, string>;
      existing_booking?: {
        id: number;
        service_name: string;
        service_package_id: number | null;
        event_date: string;
        event_time: string;
        guest_name: string;
        guest_company?: string | null;
        guest_phone?: string | null;
        guest_email?: string | null;
        calendar_event_id?: number | null;
        can_reschedule: boolean;
      } | null;
      links?: {
        contact_id?: number | null;
        company_id?: number | null;
        deal_id?: number | null;
      };
    }>("get_public_booking", {
      token: payload.token,
      ...(payload.date ? { date: payload.date } : {}),
    });
  },

  async getPublicBookingSlots(payload: { token: string; date: string }) {
    return invokePublicEdgeFunction<{ date: string; slots: string[] }>(
      "get_public_booking",
      { token: payload.token, date: payload.date },
    );
  },

  async submitPublicBooking(payload: {
    token: string;
    rescheduleBookingId?: number | null;
    servicePackageId?: number | null;
    serviceName: string;
    eventDate: string;
    eventTime: string;
    guest: {
      name: string;
      company?: string;
      phone?: string;
      email?: string;
    };
  }) {
    return invokePublicEdgeFunction<{
      ok: boolean;
      rescheduled?: boolean;
      booking_id?: number | null;
      calendar_event_id?: number;
      contact_id?: number | null;
      confirmation?: {
        service_name: string;
        event_date: string;
        event_time: string;
        host_name?: string | null;
        guest_name: string;
      };
    }>("submit_public_booking", {
      token: payload.token,
      reschedule_booking_id: payload.rescheduleBookingId ?? null,
      service_package_id: payload.servicePackageId ?? null,
      service_name: payload.serviceName,
      event_date: payload.eventDate,
      event_time: payload.eventTime,
      guest: payload.guest,
      app_base_url: window.location.origin,
    });
  },
};
