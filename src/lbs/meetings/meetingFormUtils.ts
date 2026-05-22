import { useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useGetOne, type Identifier } from "ra-core";
import type { Contact } from "@/components/atomic-crm/types";
import { getContactDisplayName } from "@/lbs/calendar/calendarReminderOptions";

export const buildMeetingTitle = (contactName?: string | null) => {
  const name = contactName?.trim();
  return name ? `Call with ${name}` : "";
};

export const MeetingContactTitleSync = () => {
  const { setValue, getValues } = useFormContext();
  const contactId = useWatch({ name: "contact_id" }) as Identifier | null | undefined;
  const title = useWatch({ name: "title" }) as string | null | undefined;

  const { data: contact } = useGetOne<Contact>(
    "contacts_summary",
    { id: contactId! },
    { enabled: contactId != null && String(contactId).trim() !== "" },
  );

  useEffect(() => {
    if (!contactId || !contact) return;

    const contactName = getContactDisplayName(contact);
    const nextTitle = buildMeetingTitle(contactName);
    const currentTitle = String(title ?? "").trim();
    const previousAutoTitle = buildMeetingTitle(
      getValues("_meeting_contact_name") as string | null | undefined,
    );

    if (!currentTitle || currentTitle === previousAutoTitle || currentTitle === "Client video call") {
      setValue("title", nextTitle, { shouldDirty: true });
    }

    setValue("_meeting_contact_name", contactName, { shouldDirty: false });
  }, [contact, contactId, getValues, setValue, title]);

  return null;
};
