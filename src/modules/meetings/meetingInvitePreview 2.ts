import type { QuickMeetingShareParts } from "@/modules/meetings/quickMeetingShareMessage";

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const buildMeetingInviteSubject = (
  orgName: string,
  meetingTitle: string,
) => `${orgName.trim() || "Organization"}: ${meetingTitle.trim() || "Video call"}`;

export const buildMeetingInviteEmailHtml = ({
  greeting,
  intro,
  meetingUrl,
  signature,
}: Pick<
  QuickMeetingShareParts,
  "greeting" | "intro" | "meetingUrl" | "signature"
>) => {
  const introHtml = escapeHtml(intro).replace(/\n/g, "<br>");
  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;color:#0f172a;line-height:1.6;max-width:520px;margin:0 auto;">
      <p style="margin:0 0 16px;font-size:16px;">${escapeHtml(greeting)}</p>
      <p style="margin:0 0 20px;font-size:15px;color:#334155;">${introHtml}</p>
      <p style="margin:0 0 24px;">
        <a href="${escapeHtml(meetingUrl)}" style="display:inline-block;background:#378ADD;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Join video call</a>
      </p>
      <p style="margin:0;font-size:14px;color:#64748b;">${escapeHtml(signature)}</p>
    </div>`;
};
