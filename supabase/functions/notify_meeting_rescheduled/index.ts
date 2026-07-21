import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { hasMemberCapability } from "../_shared/memberModulePermissions.ts";
import { notifyMeetingRescheduled } from "../_shared/notifyMeeting.ts";

type Body = {
  calendar_event_id?: number;
  share_email?: boolean;
  share_sms?: boolean;
  app_base_url?: string | null;
};

Deno.serve(
  OptionsMiddleware(async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    return UserMiddleware(req, async (req, user) => {
      if (!user) {
        return createErrorResponse(401, "Unauthorized");
      }

      try {
        const member = await getUserOrganizationMember(user);
        if (!member?.id || !member.org_id) {
          return createErrorResponse(401, "Unauthorized");
        }

        if (
          !member.administrator &&
          !hasMemberCapability(member, "meetings.manage") &&
          !hasMemberCapability(member, "calendar.manage")
        ) {
          return createErrorResponse(
            403,
            "You cannot send meeting notifications",
          );
        }

        const body = (await req.json()) as Body;
        const calendarEventId = Number(body.calendar_event_id);
        if (!Number.isFinite(calendarEventId) || calendarEventId <= 0) {
          return createErrorResponse(400, "calendar_event_id is required");
        }

        const result = await notifyMeetingRescheduled(supabaseAdmin, {
          orgId: member.org_id,
          calendarEventId,
          memberId: Number(member.id),
          shareEmail: body.share_email === true,
          shareSms: body.share_sms === true,
          appBaseUrl: body.app_base_url,
        });

        return new Response(JSON.stringify({ ok: true, ...result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("notify_meeting_rescheduled.error", error);
        return createErrorResponse(
          500,
          error instanceof Error ? error.message : "Unexpected error",
        );
      }
    });
  }),
);
