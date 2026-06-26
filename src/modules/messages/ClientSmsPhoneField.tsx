import type { Contact } from "@/modules/types";
import {
  getContactPhoneEntries,
  resolveClientSmsPhone,
} from "@/modules/messages/messageContactUtils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const ClientSmsPhoneField = ({
  contact,
  value,
  onChange,
  disabled,
  className,
  variant = "default",
}: {
  contact?: Contact | null;
  value?: string | null;
  onChange?: (e164: string) => void;
  disabled?: boolean;
  className?: string;
  variant?: "default" | "header";
}) => {
  if (!contact) return null;

  const entries = getContactPhoneEntries(contact);
  const selectValue =
    resolveClientSmsPhone(contact, value) ?? entries[0]?.e164 ?? "";

  const headerTextClass =
    variant === "header"
      ? "text-sm text-muted-foreground"
      : "text-[11px] text-muted-foreground";

  if (entries.length === 0) {
    return (
      <p className={cn(headerTextClass, className)}>
        No phone on file for this contact.
      </p>
    );
  }

  if (entries.length === 1) {
    return (
      <p className={cn("min-w-0 truncate", headerTextClass, className)}>
        <span className="text-muted-foreground">To </span>
        <span className="font-medium text-foreground">
          {entries[0].display}
        </span>
        {entries[0].label !== "Phone" ? (
          <span className="text-muted-foreground"> · {entries[0].label}</span>
        ) : null}
      </p>
    );
  }

  if (variant === "header") {
    return (
      <div
        className={cn("flex min-w-0 items-center gap-1.5 text-sm", className)}
      >
        <span className="shrink-0 text-muted-foreground">To</span>
        <Select
          value={selectValue}
          onValueChange={(next) => onChange?.(next)}
          disabled={disabled}
        >
          <SelectTrigger className="h-auto min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-medium text-foreground shadow-none focus:ring-0">
            <SelectValue placeholder="Choose number" />
          </SelectTrigger>
          <SelectContent>
            {entries.map((entry) => (
              <SelectItem key={entry.e164} value={entry.e164}>
                {entry.display}
                {entry.label !== "Phone" ? ` · ${entry.label}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2 text-[11px]", className)}>
      <span className="shrink-0 text-muted-foreground">To</span>
      <Select
        value={selectValue}
        onValueChange={(next) => onChange?.(next)}
        disabled={disabled}
      >
        <SelectTrigger
          size="sm"
          className="h-7 min-w-0 flex-1 rounded-none border-border/70 bg-background px-2 text-[11px] font-medium"
        >
          <SelectValue placeholder="Choose number" />
        </SelectTrigger>
        <SelectContent>
          {entries.map((entry) => (
            <SelectItem key={entry.e164} value={entry.e164}>
              {entry.display}
              {entry.label !== "Phone" ? ` · ${entry.label}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
