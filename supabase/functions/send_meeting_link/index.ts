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
import { resolveOrgGeneralFrom } from "../_shared/organizationEmailSenders.ts";
import { resolveContactEmail } from "../_shared/clientProposalBilling.ts";
import { INVOICE_ORGANIZATION_NAME } from "../_shared/invoiceOrganizationInfo.ts";

type SendMeetingLinkBody = {
  contact_id?: number;
  to?: string;
  meeting_url?: string;
  title?: string;
  greeting?: string;
  intro?: string;
  signature?: string;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_INTRO = "Join our video call using the link below:";

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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
          String(body.to ?? "")
            .trim()
            .toLowerCase() ||
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
        const greeting = body.greeting?.trim() || "Hi,";
        const intro = body.intro?.trim() || DEFAULT_INTRO;
        const signature =
          body.signature?.trim() ||
          `${member.first_name?.trim() || "Team"} from ${orgName}`;
        const subject = `${orgName}: ${meetingTitle}`;

        const textBody = [greeting, "", intro, meetingUrl, "", signature].join(
          "\n",
        );

        const introHtml = escapeHtml(intro).replace(/\n/g, "<br>");
        const htmlBody = `
          <div style="font-family:system-ui,-apple-system,sans-serif;color:#0f172a;line-height:1.6;max-width:520px;margin:0 auto;">
            <p style="margin:0 0 16px;font-size:16px;">${escapeHtml(greeting)}</p>
            <p style="margin:0 0 20px;font-size:15px;color:#334155;">${introHtml}</p>
            <p style="margin:0 0 24px;">
              <a href="${escapeHtml(meetingUrl)}" style="display:inline-block;background:#378ADD;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Join video call</a>
            </p>
            <p style="margin:0;font-size:14px;color:#64748b;">${escapeHtml(signature)}</p>
          </div>`;

        const generalFrom = await resolveOrgGeneralFrom(member.org_id, orgName);

        await sendTransactionalEmail({
          orgId: member.org_id,
          orgName,
          to,
          subject,
          textBody,
          htmlBody,
          fromEmail: generalFrom.email,
          fromName: generalFrom.name,
          replyTo: generalFrom.email,
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
