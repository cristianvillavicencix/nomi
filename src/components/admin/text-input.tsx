import type { InputProps } from "ra-core";
import { useInput, useResourceContext, FieldTitle } from "ra-core";
import { useState } from "react";
import {
  FormControl,
  FormError,
  FormField,
  FormLabel,
} from "@/components/admin/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FloatingFieldShell, floatingFieldPlaceholder } from "@/components/ui/floating-field";
import { InputHelperText } from "@/components/admin/input-helper-text";
import { cn } from "@/lib/utils";

export type TextInputProps = InputProps & {
  multiline?: boolean;
  inputClassName?: string;
  /** Floating label sits inside the field and rises when focused or filled. */
  labelVariant?: "default" | "floating";
} & React.ComponentProps<"textarea"> &
  React.ComponentProps<"input">;

/**
 * Single-line or multiline text input for string values.
 *
 * Use `<TextInput>` for short text fields like titles or names. Set `multiline` to `true`
 * for longer content like descriptions or comments. Wraps shadcn's `<Input>` or `<Textarea>`
 * component depending on the `multiline` prop.
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/textinput/ TextInput documentation}
 */
export const TextInput = (props: TextInputProps) => {
  const resource = useResourceContext(props);
  const {
    label,
    source,
    multiline,
    className,
    inputClassName,
    helperText,
    labelVariant = "default",
    validate: _validateProp,
    format: _formatProp,
    placeholder,
    ...rest
  } = props;
  const { id, field, isRequired } = useInput(props);
  const [focused, setFocused] = useState(false);

  const labelNode =
    label !== false ? (
      <FieldTitle
        label={label}
        source={source}
        resource={resource}
        isRequired={false}
      />
    ) : null;

  const hasValue = String(field.value ?? "").length > 0;
  const floatingActive = focused || hasValue;
  const resolvedPlaceholder =
    labelVariant === "floating"
      ? floatingFieldPlaceholder(floatingActive, placeholder)
      : placeholder;

  if (labelVariant === "floating" && label !== false) {
    return (
      <FormField
        id={id}
        className={cn("gap-1.5", className)}
        name={field.name}
      >
        <FloatingFieldShell
          active={floatingActive}
          label={labelNode}
          htmlFor={id}
          required={isRequired}
          labelAlign={multiline ? "top" : "center"}
          className={multiline ? "min-h-[5.5rem] items-stretch" : undefined}
        >
          <FormControl>
            {multiline ? (
              <Textarea
                {...rest}
                {...field}
                id={id}
                placeholder={resolvedPlaceholder}
                className={cn(
                  "min-h-[5.5rem] resize-y rounded-md border-0 bg-transparent px-3 py-2.5 shadow-none focus-visible:ring-0",
                  inputClassName,
                )}
                onFocus={(event) => {
                  setFocused(true);
                  rest.onFocus?.(event as never);
                }}
                onBlur={(event) => {
                  setFocused(false);
                  field.onBlur();
                  rest.onBlur?.(event as never);
                }}
              />
            ) : (
              <Input
                {...rest}
                {...field}
                id={id}
                placeholder={resolvedPlaceholder}
                className={cn(
                  "h-9 border-0 bg-transparent px-3 shadow-none focus-visible:ring-0",
                  inputClassName,
                )}
                onFocus={(event) => {
                  setFocused(true);
                  rest.onFocus?.(event);
                }}
                onBlur={(event) => {
                  setFocused(false);
                  field.onBlur();
                  rest.onBlur?.(event);
                }}
              />
            )}
          </FormControl>
        </FloatingFieldShell>
        <InputHelperText helperText={helperText} />
        <FormError />
      </FormField>
    );
  }

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
        {multiline ? (
          <Textarea {...rest} {...field} className={inputClassName} />
        ) : (
          <Input
            {...rest}
            {...field}
            placeholder={placeholder}
            className={inputClassName}
          />
        )}
      </FormControl>
      <InputHelperText helperText={helperText} />
      <FormError />
    </FormField>
  );
};
