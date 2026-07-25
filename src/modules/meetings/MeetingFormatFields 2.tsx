import { useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useGetOne, type Identifier } from "ra-core";
import type { Contact } from "@/components/atomic-crm/types";
import { getContactPhone } from "@/modules/clients/clientShowUtils";
import { GooglePlacesAutocompleteInput } from "@/components/admin/google-places-autocomplete-input";
import { TextInput } from "@/components/admin/text-input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DEFAULT_MEETING_FORMAT,
  MEETING_FORMAT_CHOICES,
  type MeetingFormat,
} from "@/modules/meetings/meetingFormat";
import { MeetingVideoCallSection } from "@/modules/meetings/MeetingVideoCallSection";
import { cn } from "@/lib/utils";

export const MeetingFormatFields = () => {
  const { setValue } = useFormContext();
  const meetingFormat = (useWatch({ name: "meeting_format" }) ??
    DEFAULT_MEETING_FORMAT) as MeetingFormat;
  const contactId = useWatch({ name: "contact_id" }) as Identifier | null;

  const { data: contact } = useGetOne<Contact>(
    "contacts",
    { id: contactId! },
    { enabled: meetingFormat === "phone" && contactId != null },
  );

  useEffect(() => {
    if (meetingFormat === "video") return;
    setValue("meeting_url", null, { shouldDirty: true });
    setValue("_meeting_link_seed", null, { shouldDirty: false });
    if (meetingFormat === "custom_link") {
      setValue("location", null, { shouldDirty: true });
    }
  }, [meetingFormat, setValue]);

  const contactPhone =
    contact && contactId ? getContactPhone(contact) : null;
  const hasContactPhone = Boolean(
    contact && contactId && contactPhone && contactPhone !== "—",
  );

  return (
    <>
      <ToggleGroup
        type="single"
        value={meetingFormat}
        onValueChange={(value) => {
          if (!value) return;
          setValue("meeting_format", value as MeetingFormat, {
            shouldDirty: true,
            shouldValidate: true,
          });
        }}
        className="flex w-full flex-wrap justify-start gap-1 rounded-md border bg-muted/20 p-1"
      >
        {MEETING_FORMAT_CHOICES.map((choice) => (
          <ToggleGroupItem
            key={choice.id}
            value={choice.id}
            aria-label={choice.name}
            className={cn(
              "h-8 flex-1 px-2 text-xs sm:flex-none sm:px-3",
              "data-[state=on]:bg-background data-[state=on]:shadow-sm",
            )}
          >
            {choice.name}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {meetingFormat === "video" ? <MeetingVideoCallSection /> : null}

      {meetingFormat === "phone" ? (
        <div className="space-y-2">
          {hasContactPhone ? (
            <p className="text-sm text-muted-foreground">
              Contact phone:{" "}
              <span className="font-medium text-foreground">{contactPhone}</span>
            </p>
          ) : contactId ? (
            <p className="text-sm text-muted-foreground">
              No phone number on this contact yet.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a contact to show their phone number.
            </p>
          )}
          <TextInput
            source="location"
            label={false}
            helperText={false}
            placeholder="Dial-in notes (optional)"
          />
        </div>
      ) : null}

      {meetingFormat === "in_person" ? (
        <GooglePlacesAutocompleteInput
          source="location"
          label={false}
          helperText={false}
          mode="address"
          placeholder="Meeting address"
          validate={(value) =>
            String(value ?? "").trim() ? undefined : "Address is required"
          }
        />
      ) : null}

      {meetingFormat === "custom_link" ? (
        <TextInput
          source="meeting_url"
          label={false}
          helperText={false}
          placeholder="https://zoom.us/j/..."
          validate={(value) =>
            String(value ?? "").trim() ? undefined : "Meeting link is required"
          }
        />
      ) : null}
    </>
  );
};
