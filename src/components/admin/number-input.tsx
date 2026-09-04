import * as React from "react";
import { useEffect, useState } from "react";
import type { InputProps } from "ra-core";
import { FieldTitle, useInput, useResourceContext } from "ra-core";
import {
  FormControl,
  FormError,
  FormField,
  FormLabel,
} from "@/components/admin/form";
import { Input } from "@/components/ui/input";
import { FloatingFieldShell, floatingFieldPlaceholder } from "@/components/ui/floating-field";
import { InputHelperText } from "@/components/admin/input-helper-text";
import { cn } from "@/lib/utils";

/**
 * Input component for numeric values (integers and floats) with parsing and formatting support.
 *
 * Use `<NumberInput>` for prices, quantities, counts, or any numeric field. Manages a local string
 * state internally so users can type incomplete numbers (e.g. '-' or '0.') before the value is parsed.
 * Supports min/max constraints and step increments.
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/numberinput/ NumberInput documentation}
 */
export const NumberInput = (props: NumberInputProps) => {
  const {
    label,
    source,
    className,
    resource: resourceProp,
    validate: _validateProp,
    format: _formatProp,
    parse = convertStringToNumber,
    onFocus,
    helperText,
    labelVariant = "default",
    ...rest
  } = props;
  const resource = useResourceContext({ resource: resourceProp });

  const { id, field, isRequired } = useInput(props);
  const [focused, setFocused] = useState(false);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    const numberValue = parse(next);

    setValue(next);
    field.onChange(numberValue ?? 0);
  };

  const [value, setValue] = useState<string | undefined>(
    field.value?.toString() ?? "",
  );

  const hasFocus = React.useRef(false);

  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    onFocus?.(event);
    hasFocus.current = true;
    setFocused(true);
  };

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    field.onBlur?.(event);
    hasFocus.current = false;
    setFocused(false);
    setValue(field.value?.toString() ?? "");
  };

  useEffect(() => {
    if (!hasFocus.current) {
      setValue(field.value?.toString() ?? "");
    }
  }, [field.value]);

  const useFloating = labelVariant === "floating" && label !== false;
  const hasValue = String(value ?? "").length > 0;
  const floatingActive = focused || hasValue;
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
        {...field}
        type="number"
        value={value}
        placeholder={
          useFloating
            ? floatingFieldPlaceholder(floatingActive, rest.placeholder)
            : rest.placeholder
        }
        className={cn(
          useFloating &&
            "h-9 border-0 bg-transparent px-3 shadow-none focus-visible:ring-0",
        )}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
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

export interface NumberInputProps
  extends InputProps,
    Omit<
      React.ComponentProps<"input">,
      "defaultValue" | "onBlur" | "onChange" | "type"
    > {
  parse?: (value: string) => number;
  labelVariant?: "default" | "floating";
}

const convertStringToNumber = (value?: string | null) => {
  if (value == null || value === "") {
    return null;
  }
  const float = parseFloat(value);

  return isNaN(float) ? 0 : float;
};
