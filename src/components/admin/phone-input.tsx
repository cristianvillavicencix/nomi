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
import { FloatingFieldShell } from "@/components/ui/floating-field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  formatUsPhoneDisplayFromAny,
  isValidUsPhone,
  normalizeUsPhoneToE164,
} from "@/utils/phone";

export type PhoneInputProps = InputProps &
  React.ComponentProps<"input"> & {
    labelVariant?: "default" | "floating";
  };

const validatePhone: Validator = (value) => {
  if (value == null || value === "") {
    return undefined;
  }

  return isValidUsPhone(String(value))
    ? undefined
    : "Invalid phone. Use 10 digits";
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
    labelVariant = "default",
    placeholder,
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
  const [focused, setFocused] = useState(false);

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

  const useFloating = labelVariant === "floating" && label !== false;
  const floatingActive = focused || String(displayValue).length > 0;
  const labelNode =
    label !== false ? (
      <FieldTitle
        label={label}
        source={source}
        resource={resource}
        isRequired={useFloating ? false : isRequired}
      />
    ) : null;

  const inputEl = (
    <FormControl>
      <Input
        {...rest}
        id={id}
        name={field.name}
        ref={field.ref}
        autoComplete="tel-national"
        value={displayValue}
        placeholder={useFloating ? (placeholder ?? " ") : placeholder}
        className={cn(
          useFloating &&
            "h-9 border-0 bg-transparent px-3 shadow-none focus-visible:ring-0",
        )}
        onFocus={() => setFocused(true)}
        onChange={(event) => {
          const rawValue = event.target.value;
          setDisplayValue(rawValue);
          field.onChange(rawValue);
          onChange?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          const rawValue = event.target.value.trim();
          const normalized = rawValue ? normalizeUsPhoneToE164(rawValue) : "";
          if (normalized) {
            field.onChange(normalized);
            setDisplayValue(formatUsPhoneDisplayFromAny(normalized));
          } else {
            field.onChange(rawValue);
            setDisplayValue(rawValue);
          }
          field.onBlur();
          onBlur?.(event);
        }}
      />
    </FormControl>
  );

  if (useFloating) {
    return (
      <FormField id={id} className={cn("gap-1.5", className)} name={field.name}>
        <FloatingFieldShell
          active={floatingActive}
          label={labelNode}
          htmlFor={id}
          required={isRequired}
        >
          {inputEl}
        </FloatingFieldShell>
        <InputHelperText helperText={helperText} />
        <FormError />
      </FormField>
    );
  }

  return (
    <FormField id={id} className={className} name={field.name}>
      {labelNode ? <FormLabel>{labelNode}</FormLabel> : null}
      {inputEl}
      <InputHelperText helperText={helperText} />
      <FormError />
    </FormField>
  );
};
