import { Plus, X } from "lucide-react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { SelectInput } from "@/components/admin/select-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  REMIND_BEFORE_CHOICES,
  REMIND_BEFORE_NONE,
} from "@/modules/calendar/calendarReminderOptions";
import { MAX_CALENDAR_REMINDERS } from "@/modules/calendar/calendarReminderWriteUtils";

const formatRemindBefore = (value?: number | null) =>
  value == null ? REMIND_BEFORE_NONE : value;

const parseRemindBefore = (value: string | number) => {
  if (value === REMIND_BEFORE_NONE || value === "" || value == null)
    return null;
  return Number(value);
};

export const CalendarReminderOffsetsInput = ({
  source = "reminder_offsets_minutes",
  label = "Reminders",
}: {
  source?: string;
  label?: string;
}) => {
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: source,
  });

  const canAdd = fields.length < MAX_CALENDAR_REMINDERS;

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <p className="text-xs text-muted-foreground">
        Up to {MAX_CALENDAR_REMINDERS} alerts before the event.
      </p>
      <div className="space-y-2">
        {fields.map((field, index) => (
          <div key={field.id} className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <SelectInput
                source={`${source}.${index}`}
                label={false}
                choices={[...REMIND_BEFORE_CHOICES]}
                format={formatRemindBefore}
                parse={parseRemindBefore}
                helperText={false}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="icon-sm"
              className="mt-0.5 shrink-0"
              aria-label="Remove reminder"
              onClick={() => remove(index)}
            >
              <X className="size-4" />
            </Button>
          </div>
        ))}
      </div>
      {canAdd ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => append(15)}
        >
          <Plus className="size-4" />
          Add reminder
        </Button>
      ) : null}
    </div>
  );
};
