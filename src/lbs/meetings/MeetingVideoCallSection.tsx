import { useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import {
  createMeetingLinkSeed,
  generateJitsiMeetingUrl,
  getMeetingLinkSeedFromUrl,
} from "@/lbs/meetings/jitsiMeeting";
import { DEFAULT_MEETING_DURATION_MINUTES } from "@/lbs/calendar/calendarReminderOptions";
import { MeetingLinkActions } from "@/lbs/meetings/MeetingLinkActions";

export const MeetingVideoCallSection = () => {
  const { setValue, getValues } = useFormContext();
  const meetingUrl = useWatch({ name: "meeting_url" }) as string | null | undefined;
  const title = useWatch({ name: "title" }) as string | null | undefined;
  const contactId = useWatch({ name: "contact_id" });
  const durationMinutes = useWatch({ name: "duration_minutes" });

  useEffect(() => {
    if (!contactId) {
      setValue("meeting_url", null, { shouldDirty: true });
      setValue("_meeting_link_seed", null, { shouldDirty: false });
      return;
    }

    const titleTrimmed = String(title ?? "").trim();
    if (!titleTrimmed) return;

    if (durationMinutes == null || durationMinutes === "") {
      setValue("duration_minutes", DEFAULT_MEETING_DURATION_MINUTES, {
        shouldDirty: true,
      });
    }

    let seed = getValues("_meeting_link_seed") as string | null | undefined;
    if (!seed?.trim()) {
      seed =
        getMeetingLinkSeedFromUrl(meetingUrl) || createMeetingLinkSeed();
      setValue("_meeting_link_seed", seed, { shouldDirty: false });
    }

    const nextUrl = generateJitsiMeetingUrl({ title: titleTrimmed, seed });
    if (meetingUrl !== nextUrl) {
      setValue("meeting_url", nextUrl, { shouldDirty: true });
    }
  }, [
    contactId,
    durationMinutes,
    getValues,
    meetingUrl,
    setValue,
    title,
  ]);

  if (!contactId) {
    return (
      <p className="text-sm text-muted-foreground">
        Select a contact to generate the video call link.
      </p>
    );
  }

  if (!String(title ?? "").trim()) {
    return (
      <p className="text-sm text-muted-foreground">
        Add a title to generate the video call link.
      </p>
    );
  }

  if (!meetingUrl?.trim()) {
    return (
      <p className="text-sm text-muted-foreground">Generating video call link…</p>
    );
  }

  const regenerateLink = () => {
    const titleTrimmed = String(title ?? "").trim();
    const seed = createMeetingLinkSeed();
    setValue("_meeting_link_seed", seed, { shouldDirty: false });
    setValue(
      "meeting_url",
      generateJitsiMeetingUrl({ title: titleTrimmed, seed }),
      { shouldDirty: true },
    );
  };

  return (
    <MeetingLinkActions
      meetingUrl={meetingUrl}
      onRegenerate={regenerateLink}
      variant="field"
    />
  );
};
