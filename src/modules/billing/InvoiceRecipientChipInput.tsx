import { X } from "lucide-react";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import {
  getInvalidInvoiceEmails,
  parseInvoiceEmailList,
  splitInvoiceListInput,
} from "@/modules/billing/billingUtils";
import {
  formatUsPhoneDisplayFromAny,
  isValidUsPhone,
  normalizeUsPhoneToE164,
} from "@/utils/phone";

type InvoiceRecipientChipInputProps = {
  id: string;
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  mode: "email" | "phone";
  placeholder?: string;
  helperText?: string;
};

const emailDuplicate = (values: string[], email: string) =>
  values.some((entry) => entry.toLowerCase() === email.toLowerCase());

const phoneDuplicate = (values: string[], phone: string) => {
  const e164 = normalizeUsPhoneToE164(phone);
  if (!e164) return false;
  return values.some((entry) => normalizeUsPhoneToE164(entry) === e164);
};

const normalizeEmailChip = (value: string) => {
  const invalid = getInvalidInvoiceEmails(value);
  if (invalid.length > 0) return null;
  return parseInvoiceEmailList(value)[0] ?? null;
};

const normalizePhoneChip = (value: string) => {
  if (!isValidUsPhone(value)) return null;
  const formatted = formatUsPhoneDisplayFromAny(value);
  return formatted === "—" ? value.trim() : formatted;
};

export const InvoiceRecipientChipInput = ({
  id,
  label,
  values,
  onChange,
  mode,
  placeholder,
  helperText,
}: InvoiceRecipientChipInputProps) => {
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);

  const commit = (raw: string) => {
    setDraftError(null);
    const parts = splitInvoiceListInput(raw);
    if (parts.length === 0) return;

    const merged = [...values];
    for (const part of parts) {
      const normalized =
        mode === "email" ? normalizeEmailChip(part) : normalizePhoneChip(part);

      if (!normalized) {
        setDraftError(
          mode === "email"
            ? "Enter a valid email address"
            : "Enter a valid 10-digit US mobile number",
        );
        return;
      }

      const duplicate =
        mode === "email"
          ? emailDuplicate(merged, normalized)
          : phoneDuplicate(merged, normalized);

      if (!duplicate) {
        merged.push(normalized);
      }
    }

    onChange(merged);
    setDraft("");
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 focus-within:ring-1 focus-within:ring-ring">
        {values.map((value) => (
          <span
            key={value}
            className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
          >
            <span className="truncate">{value}</span>
            <button
              type="button"
              className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
              aria-label={`Remove ${value}`}
              onClick={() => onChange(values.filter((entry) => entry !== value))}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          className="min-w-[8rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          value={draft}
          placeholder={values.length === 0 ? placeholder : undefined}
          type={mode === "email" ? "text" : "tel"}
          inputMode={mode === "email" ? "email" : "tel"}
          autoComplete={mode === "email" ? "email" : "tel"}
          onChange={(event) => {
            setDraftError(null);
            setDraft(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === "," || event.key === ";") {
              event.preventDefault();
              commit(draft);
            } else if (
              event.key === "Backspace" &&
              !draft &&
              values.length > 0
            ) {
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={() => {
            if (draft.trim()) commit(draft);
          }}
        />
      </div>
      {helperText ? (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      ) : null}
      {draftError ? (
        <p className="text-xs text-destructive">{draftError}</p>
      ) : null}
    </div>
  );
};
