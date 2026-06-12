import type { Contact } from "@/components/atomic-crm/types";

const DEFAULT_INTRO = "Join our video call using the link below:";

export type QuickMeetingShareParts = {
  greeting: string;
  intro: string;
  meetingUrl: string;
  signature: string;
  smsBody: string;
};

export const buildQuickMeetingShareParts = ({
  contact,
  meetingUrl,
  notes,
  senderFirstName,
  orgName,
}: {
  contact?: Contact | null;
  meetingUrl: string;
  notes?: string | null;
  senderFirstName?: string | null;
  orgName?: string | null;
}): QuickMeetingShareParts => {
  const contactFirst = contact?.first_name?.trim();
  const greeting = contactFirst ? `Hi ${contactFirst},` : "Hi,";
  const notesTrimmed = notes?.trim();
  const intro = DEFAULT_INTRO;
  const sender = senderFirstName?.trim() || "Team";
  const org = orgName?.trim() || "Latino Business Support";
  const signature = `${sender} from ${org}`;
  const url = meetingUrl.trim();

  const smsBody = notesTrimmed
    ? [greeting, "", notesTrimmed, "", intro, url, "", signature].join("\n")
    : [greeting, "", intro, url, "", signature].join("\n");

  return {
    greeting,
    intro: notesTrimmed ? `${notesTrimmed}\n\n${intro}` : intro,
    meetingUrl: url,
    signature,
    smsBody,
  };
};

export const getSenderFirstName = (identity?: {
  first_name?: string | null;
  fullName?: string | null;
} | null) => {
  const fromField = identity?.first_name?.trim();
  if (fromField) return fromField;
  const full = identity?.fullName?.trim();
  if (!full) return "Team";
  return full.split(/\s+/)[0] || "Team";
};
