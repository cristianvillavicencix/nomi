import { Plus, X } from "lucide-react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { SelectInput } from "@/components/admin/select-input";
import { IconButton } from "@/components/ui/icon-button";
import { Label } from "@/components/ui/label";
import {
  REMIND_BEFORE_CHOICES,
  REMIND_BEFORE_NONE,
} from "@/modules/calendar/calendarReminderOptions";
import { MAX_CALENDAR_REMINDERS } from "@/modules/calendar/calendarReminderWriteUtils";
import { cn } from "@/lib/utils";

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
  showLabel = true,
  className,
}: {
  source?: string;
  label?: string | false;
  showLabel?: boolean;
  className?: string;
}) => {
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: source,
  });

  const canAdd = fields.length < MAX_CALENDAR_REMINDERS;
  const resolvedLabel = label === false ? false : label;

  return (
    <div className={cn("space-y-2", className)}>
      {showLabel && resolvedLabel !== false ? (
        <Label>{resolvedLabel}</Label>
      ) : null}
      <div className="space-y-2">
        {fields.map((field, index) => (
          <div key={field.id} className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <SelectInput
                source={`${source}.${index}`}
                label={false}
                choices={[...REMIND_BEFORE_CHOICES]}
                format={formatRemindBefore}
                parse={parseRemindBefore}
                helperText={false}
                className="w-full [&_[data-slot=select-trigger]]:h-9 [&_[data-slot=select-trigger]]:w-full"
              />
            </div>
            {fields.length > 1 ? (
              <IconButton
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0 text-muted-foreground"
                aria-label="Remove reminder"
                onClick={() => remove(index)}
              >
                <X className="size-4" />
              </IconButton>
            ) : null}
            {index === fields.length - 1 && canAdd ? (
              <IconButton
                type="button"
                variant="secondary"
                size="icon-sm"
                className="shrink-0"
                aria-label="Add reminder"
                onClick={() => append(15)}
              >
                <Plus className="size-4" />
              </IconButton>
            ) : null}
          </div>
        ))}
      </div>
      {fields.length === 0 ? (
        <div className="flex items-center justify-end">
          <IconButton
            type="button"
            variant="secondary"
            size="icon-sm"
            aria-label="Add reminder"
            onClick={() => append(15)}
          >
            <Plus className="size-4" />
          </IconButton>
        </div>
      ) : null}
    </div>
  );
};
