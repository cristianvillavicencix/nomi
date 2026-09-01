import type { InputProps, Validator } from "ra-core";
import { FieldTitle, useInput, useResourceContext } from "ra-core";
import { useEffect, useMemo, useState } from "react";
import {
  FormControl,
  FormError,
  FormField,
  FormLabel,
} from "@/components/admin/form";
import { InputHelperText } from "@/components/admin/input-helper-text";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { FloatingFieldShell } from "@/components/ui/floating-field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { getEmailDomainSuggestions, isValidEmail } from "@/utils/email";

export type EmailInputProps = InputProps &
  React.ComponentProps<"input"> & {
    labelVariant?: "default" | "floating";
  };

const validateEmail: Validator = (value) => {
  if (value == null || value === "") {
    return undefined;
  }

  return isValidEmail(String(value)) ? undefined : "Invalid email address";
};

export const EmailInput = (props: EmailInputProps) => {
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
    ? [...validate, validateEmail]
    : validate
      ? [validate, validateEmail]
      : [validateEmail];

  const { id, field, isRequired } = useInput({
    ...props,
    // Keep custom handlers on the DOM input only — RHF field.onBlur() has no event.
    onBlur: undefined,
    onChange: undefined,
    validate: validators,
  });
  const [inputValue, setInputValue] = useState("");
  const [open, setOpen] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);

  useEffect(() => {
    setInputValue(field.value ?? "");
  }, [field.value]);

  const suggestions = useMemo(
    () => getEmailDomainSuggestions(inputValue),
    [inputValue],
  );

  useEffect(() => {
    setOpen(isInputFocused && suggestions.length > 0);
  }, [isInputFocused, suggestions]);

  const completeDomain = (domain: string) => {
    const localPart = inputValue.split("@")[0]?.trim();
    if (!localPart) {
      return;
    }

    const completedValue = `${localPart}@${domain}`;
    setInputValue(completedValue);
    field.onChange(completedValue);
    setOpen(false);
  };

  const useFloating = labelVariant === "floating" && label !== false;
  const floatingActive = isInputFocused || String(inputValue).length > 0;
  const labelNode =
    label !== false ? (
      <FieldTitle
        label={label}
        source={source}
        resource={resource}
        isRequired={useFloating ? false : isRequired}
      />
    ) : null;

  const inputControl = (
    <Popover open={open}>
      <PopoverAnchor asChild>
        <div className="relative min-w-0 w-full">
          <FormControl>
            <Input
              {...rest}
              {...field}
              id={id}
              autoComplete="email"
              value={inputValue}
              placeholder={useFloating ? (placeholder ?? " ") : placeholder}
              className={cn(
                useFloating &&
                  "h-9 border-0 bg-transparent px-3 shadow-none focus-visible:ring-0",
              )}
              onFocus={() => {
                setIsInputFocused(true);
              }}
              onChange={(event) => {
                const nextValue = event.target.value;
                setInputValue(nextValue);
                field.onChange(nextValue);
                onChange?.(event);
              }}
              onBlur={(event) => {
                const trimmedValue = event.target.value.trim();
                setInputValue(trimmedValue);
                field.onChange(trimmedValue);
                field.onBlur();
                onBlur?.(event);
                window.setTimeout(() => {
                  setIsInputFocused(false);
                }, 250);
              }}
            />
          </FormControl>
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
        }}
      >
        <Command>
          <CommandList>
            <CommandGroup heading="Suggested domains">
              {suggestions.map((domain) => (
                <CommandItem
                  key={domain}
                  value={domain}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    completeDomain(domain);
                  }}
                  onSelect={() => completeDomain(domain)}
                >
                  @{domain}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );

  if (useFloating) {
    return (
      <FormField id={id} className={cn("gap-1.5", className)} name={field.name}>
        <FloatingFieldShell
          active={floatingActive}
          label={labelNode}
          htmlFor={id}
          required={isRequired}
          className="min-w-0"
        >
          {inputControl}
        </FloatingFieldShell>
        <InputHelperText helperText={helperText} />
        <FormError />
      </FormField>
    );
  }

  return (
    <FormField id={id} className={className} name={field.name}>
      {labelNode ? <FormLabel>{labelNode}</FormLabel> : null}
      {inputControl}
      <InputHelperText helperText={helperText} />
      <FormError />
    </FormField>
  );
};
