import { useState, type ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FloatingFieldShell } from "@/components/ui/floating-field";

const floatingSelectTriggerClassName =
  "h-9 w-full border-0 bg-transparent px-3 shadow-none hover:bg-transparent focus:ring-0 data-[size=default]:h-9";

export const SubscriptionFloatingSelectField = ({
  id,
  label,
  value,
  onValueChange,
  disabled,
  children,
  activeWhenEmpty = false,
}: {
  id: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  children: ReactNode;
  activeWhenEmpty?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const active = open || activeWhenEmpty || Boolean(value && value !== "none");
  return (
    <FloatingFieldShell active={active} label={label} htmlFor={id}>
      <Select
        value={value}
        disabled={disabled}
        open={open}
        onOpenChange={setOpen}
        onValueChange={onValueChange}
      >
        <SelectTrigger id={id} className={floatingSelectTriggerClassName}>
          <SelectValue placeholder=" " />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </FloatingFieldShell>
  );
};
