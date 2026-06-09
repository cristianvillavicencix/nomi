import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { hasMemberCapability } from "../_shared/memberModulePermissions.ts";
import {
  isOrgTransactionalEmailConfigured,
  sendTransactionalEmail,
} from "../_shared/transactionalEmail.ts";
import { resolveContactEmail } from "../_shared/clientProposalBilling.ts";
import { INVOICE_ORGANIZATION_NAME } from "../_shared/invoiceOrganizationInfo.ts";

type SendMeetingLinkBody = {
  contact_id?: number;
  to?: string;
  meeting_url?: string;
  title?: string;
  message?: string;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
        if (!member?.id) {
          return createErrorResponse(401, "Unauthorized");
        }

        if (
          !member.administrator &&
          !hasMemberCapability(member, "meetings.manage") &&
          !hasMemberCapability(member, "calendar.manage")
        ) {
          return createErrorResponse(403, "You cannot send meeting links");
        }

        const body = (await req.json()) as SendMeetingLinkBody;
        const meetingUrl = body.meeting_url?.trim();
        if (!meetingUrl) {
          return createErrorResponse(400, "meeting_url is required");
        }

        const contactId = Number(body.contact_id);
        const to =
          String(body.to ?? "").trim().toLowerCase() ||
          (Number.isFinite(contactId)
            ? (await resolveContactEmail(supabaseAdmin, contactId))
                ?.trim()
                ?.toLowerCase()
            : "") ||
          "";

        if (!to || !emailRegex.test(to)) {
          return createErrorResponse(
            400,
            "No recipient email is on file for this contact",
          );
        }

        if (!(await isOrgTransactionalEmailConfigured(member.org_id))) {
          return createErrorResponse(
            400,
            "Email is not configured for your organization",
          );
        }

        const { data: org } = await supabaseAdmin
          .from("organizations")
          .select("name")
          .eq("id", member.org_id)
          .maybeSingle();

        const orgName = org?.name?.trim() || INVOICE_ORGANIZATION_NAME;
        const meetingTitle = body.title?.trim() || "Video call";
        const customMessage = body.message?.trim();
        const subject = `${orgName}: ${meetingTitle}`;
        const textBody = [
          customMessage ||
            "Join our video call using the secure link below.",
          "",
          `Join: ${meetingUrl}`,
          "",
          orgName,
        ].join("\n");

        const htmlBody = `
          <div style="font-family:system-ui,sans-serif;color:#0f172a;line-height:1.5;max-width:560px;">
            <p>${customMessage ? customMessage.replace(/\n/g, "<br>") : "Join our video call using the button below."}</p>
            <p style="margin:20px 0;"><a href="${meetingUrl}" style="display:inline-block;background:#378ADD;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Join video call</a></p>
            <p style="color:#64748b;font-size:13px;">${orgName}</p>
          </div>`;

        await sendTransactionalEmail({
          orgId: member.org_id,
          orgName,
          to,
          subject,
          textBody,
          htmlBody,
        });

        return new Response(
          JSON.stringify({ sent: true, to, meeting_url: meetingUrl }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } catch (error) {
        console.error("send_meeting_link.error", error);
        return createErrorResponse(
          500,
          error instanceof Error ? error.message : "Unexpected error",
        );
      }
    });
  }),
);
