import type { InputProps, Validator } from "ra-core";
import { FieldTitle, useInput, useResourceContext } from "ra-core";
import { useEffect, useState } from "react";
import {
  FormControl,
  FormError,
  FormField,
  FormLabel,
} from "@/components/admin/form";
import { InputHelperText } from "@/components/admin/input-helper-text";
import { Input } from "@/components/ui/input";
import {
  formatUsPhoneDisplayFromAny,
  isValidUsPhone,
  normalizeUsPhoneToE164,
} from "@/utils/phone";

export type PhoneInputProps = InputProps & React.ComponentProps<"input">;

const validatePhone: Validator = (value) => {
  if (value == null || value === "") {
    return undefined;
  }

  return isValidUsPhone(String(value)) ? undefined : "Invalid phone. Use 10 digits";
};

export const PhoneInput = (props: PhoneInputProps) => {
  const resource = useResourceContext(props);
  const {
    label,
    source,
    className,
    helperText,
    validate,
    onBlur,
    onChange,
    ...rest
  } = props;

  const validators = Array.isArray(validate)
    ? [...validate, validatePhone]
    : validate
      ? [validate, validatePhone]
      : [validatePhone];

  const { id, field, isRequired } = useInput({
    ...props,
    validate: validators,
  });
  const [displayValue, setDisplayValue] = useState("");

  useEffect(() => {
    if (field.value == null || field.value === "") {
      setDisplayValue("");
      return;
    }

    const nextValue = String(field.value);
    setDisplayValue(
      isValidUsPhone(nextValue)
        ? formatUsPhoneDisplayFromAny(nextValue)
        : nextValue,
    );
  }, [field.value]);

  return (
    <FormField id={id} className={className} name={field.name}>
      {label !== false && (
        <FormLabel>
          <FieldTitle
            label={label}
            source={source}
            resource={resource}
            isRequired={isRequired}
          />
        </FormLabel>
      )}
      <FormControl>
        <Input
          {...rest}
          {...field}
          autoComplete="tel-national"
          value={displayValue}
          onChange={(event) => {
            setDisplayValue(event.target.value);
            field.onChange(event);
            onChange?.(event);
          }}
          onBlur={(event) => {
            const rawValue = event.target.value.trim();
            const normalized = rawValue ? normalizeUsPhoneToE164(rawValue) : "";
            if (normalized) {
              field.onChange(normalized);
              setDisplayValue(formatUsPhoneDisplayFromAny(normalized));
            } else {
              field.onChange(rawValue);
            }
            field.onBlur();
            onBlur?.(event);
          }}
        />
      </FormControl>
      <InputHelperText helperText={helperText} />
      <FormError />
    </FormField>
  );
};

