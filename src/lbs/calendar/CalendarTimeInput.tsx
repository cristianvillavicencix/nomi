import type { InputProps } from "ra-core";
import { FieldTitle, useInput, useResourceContext } from "ra-core";
import {
  FormControl,
  FormError,
  FormField,
  FormLabel,
} from "@/components/admin/form";
import { InputHelperText } from "@/components/admin/input-helper-text";
import { Input } from "@/components/ui/input";
import { normalizeEventTime } from "@/lbs/calendar/calendarReminderOptions";

const formatTime = (value?: string | null) => normalizeEventTime(value) ?? "";

const parseTime = (value?: string | null) => {
  if (!value?.trim()) return null;
  return value.length === 5 ? `${value}:00` : value;
};

export const CalendarTimeInput = ({
  label,
  source,
  helperText,
  className,
  inputClassName,
  ...rest
}: InputProps & {
  inputClassName?: string;
}) => {
  const resource = useResourceContext({ source });
  const { id, field, isRequired } = useInput({
    source,
    format: formatTime,
    parse: parseTime,
    ...rest,
  });

  return (
    <FormField id={id} className={className} name={field.name}>
      {label !== false ? (
        <FormLabel>
          <FieldTitle
            label={label}
            source={source}
            resource={resource}
            isRequired={isRequired}
          />
        </FormLabel>
      ) : null}
      <FormControl>
        <Input
          {...field}
          value={field.value ?? ""}
          type="time"
          className={inputClassName}
        />
      </FormControl>
      <InputHelperText helperText={helperText} />
      <FormError />
    </FormField>
  );
};
