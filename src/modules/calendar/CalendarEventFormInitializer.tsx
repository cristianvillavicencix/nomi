import { useEffect } from "react";
import { useFormContext } from "react-hook-form";

export const CalendarEventFormInitializer = () => {
  const { getValues, setValue } = useFormContext();

  useEffect(() => {
    const assignees = getValues("assignee_member_ids");
    if (!Array.isArray(assignees) || assignees.length === 0) {
      const owner = getValues("organization_member_id");
      if (owner != null && owner !== "") {
        setValue("assignee_member_ids", [owner], { shouldDirty: false });
      }
    }

    const offsets = getValues("reminder_offsets_minutes");
    if (!Array.isArray(offsets) || offsets.length === 0) {
      const legacy = getValues("remind_before_minutes");
      if (legacy != null && legacy !== "") {
        setValue("reminder_offsets_minutes", [Number(legacy)], {
          shouldDirty: false,
        });
      }
    }
  }, [getValues, setValue]);

  return null;
};
