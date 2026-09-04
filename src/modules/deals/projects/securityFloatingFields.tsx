import { useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  FloatingFieldShell,
  floatingDateEmptyValueClassName,
  floatingFieldControlClassName,
  floatingFieldPlaceholder,
} from "@/components/ui/floating-field";
import { cn } from "@/lib/utils";

type SecurityFloatingInputProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  placeholder?: string;
  type?: "text" | "url" | "password" | "date" | "email";
  required?: boolean;
  className?: string;
  trailing?: ReactNode;
};

export const SecurityFloatingInput = ({
  id,
  label,
  value,
  onChange,
  onBlur,
  disabled,
  placeholder,
  type = "text",
  required,
  className,
  trailing,
}: SecurityFloatingInputProps) => {
  const [focused, setFocused] = useState(false);
  const active = focused || Boolean(value?.trim()) || type === "date";
  // Date inputs always show a native value chrome; treat focus or filled as active,
  // and hide ghost mm/dd/yyyy when empty + unfocused.
  const dateActive = focused || Boolean(value?.trim());
  const floatingActive = type === "date" ? dateActive : active;

  return (
    <div className={cn("flex gap-2", className)}>
      <FloatingFieldShell
        active={floatingActive}
        label={label}
        htmlFor={id}
        required={required}
        className="min-w-0 flex-1"
      >
        <Input
          id={id}
          type={type}
          value={value}
          disabled={disabled}
          className={cn(
            floatingFieldControlClassName,
            type === "date" ? floatingDateEmptyValueClassName(floatingActive) : null,
          )}
          placeholder={floatingFieldPlaceholder(floatingActive, placeholder)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          onChange={(event) => onChange(event.target.value)}
        />
      </FloatingFieldShell>
      {trailing}
    </div>
  );
};

type SecurityFloatingTextareaProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  className?: string;
};

export const SecurityFloatingTextarea = ({
  id,
  label,
  value,
  onChange,
  disabled,
  placeholder,
  rows = 3,
  required,
  className,
}: SecurityFloatingTextareaProps) => {
  const [focused, setFocused] = useState(false);
  const active = focused || Boolean(value?.trim());

  return (
    <FloatingFieldShell
      active={active}
      label={label}
      htmlFor={id}
      required={required}
      labelAlign="top"
      className={cn("items-start py-2", className)}
    >
      <Textarea
        id={id}
        value={value}
        disabled={disabled}
        rows={rows}
        className={cn(
          floatingFieldControlClassName,
          "h-auto min-h-[4.5rem] resize-y py-1 font-inherit",
        )}
        placeholder={floatingFieldPlaceholder(active, placeholder)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(event) => onChange(event.target.value)}
      />
    </FloatingFieldShell>
  );
};
