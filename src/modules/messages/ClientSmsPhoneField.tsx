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
}: {
  contact?: Contact | null;
  value?: string | null;
  onChange?: (e164: string) => void;
  disabled?: boolean;
  className?: string;
}) => {
  if (!contact) return null;

  const entries = getContactPhoneEntries(contact);
  const selectValue = resolveClientSmsPhone(contact, value) ?? entries[0]?.e164 ?? "";

  if (entries.length === 0) {
    return (
      <p className={cn("text-[11px] text-muted-foreground", className)}>
        No phone on file for this contact.
      </p>
    );
  }

  if (entries.length === 1) {
    return (
      <p className={cn("text-[11px] text-muted-foreground", className)}>
        To{" "}
        <span className="font-medium text-foreground">
          {entries[0].display}
        </span>
        {entries[0].label !== "Phone" ? (
          <span className="text-muted-foreground/80"> · {entries[0].label}</span>
        ) : null}
      </p>
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
