import { Building2, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useGetList } from "ra-core";
import type { Company, Contact } from "@/components/atomic-crm/types";
import {
  getContactEmail,
  getContactFullName,
} from "@/modules/clients/clientShowUtils";
import {
  isValidEmailList,
  parseEmailList,
} from "@/modules/tickets/ticketReplySignature";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type RecipientSuggestion = {
  id: string;
  label: string;
  email: string;
  kind: "contact" | "company";
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getCompanyEmail = (company: Company) =>
  company.primary_contact_email_jsonb
    ?.find((entry) => entry.email?.trim())
    ?.email?.trim()
    .toLowerCase() ?? "";

type TicketRecipientInputProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export const TicketRecipientInput = ({
  id,
  value,
  onChange,
  placeholder,
  disabled = false,
  className,
}: TicketRecipientInputProps) => {
  const emails = useMemo(() => parseEmailList(value), [value]);
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const token = draft.trim();
  const canSearch = token.length >= 2;

  useEffect(() => {
    if (!value.trim()) setDraft("");
  }, [value]);

  const contactFilter = useMemo(() => {
    if (!canSearch) return { "id@eq": -1 };
    return {
      "@or": {
        "first_name@ilike": token,
        "last_name@ilike": token,
        "full_name@ilike": token,
        "company_name@ilike": token,
      },
    };
  }, [canSearch, token]);

  const companyFilter = useMemo(() => {
    if (!canSearch) return { "id@eq": -1 };
    return { "name@ilike": token };
  }, [canSearch, token]);

  const { data: contacts = [] } = useGetList<Contact>("contacts_summary", {
    filter: contactFilter,
    pagination: { page: 1, perPage: 12 },
    sort: { field: "last_name", order: "ASC" },
  });

  const { data: companies = [] } = useGetList<Company>("companies", {
    filter: companyFilter,
    pagination: { page: 1, perPage: 8 },
    sort: { field: "name", order: "ASC" },
  });

  const suggestions = useMemo(() => {
    if (!canSearch) return [] as RecipientSuggestion[];

    const needle = token.toLowerCase();
    const items: RecipientSuggestion[] = [];

    for (const contact of contacts) {
      const email = getContactEmail(contact);
      if (!email || email === "—") continue;
      const name = getContactFullName(contact);
      const companyLabel = contact.company_name?.trim();
      const haystack = `${name} ${email} ${companyLabel ?? ""}`.toLowerCase();
      if (!haystack.includes(needle)) continue;
      items.push({
        id: `contact-${contact.id}`,
        label: companyLabel ? `${name} · ${companyLabel}` : name,
        email: email.toLowerCase(),
        kind: "contact",
      });
    }

    for (const company of companies) {
      const email = getCompanyEmail(company);
      if (!email) continue;
      const haystack = `${company.name} ${email}`.toLowerCase();
      if (!haystack.includes(needle)) continue;
      items.push({
        id: `company-${company.id}`,
        label: company.name,
        email,
        kind: "company",
      });
    }

    const seen = new Set(emails);
    return items.filter((item) => {
      if (seen.has(item.email)) return false;
      seen.add(item.email);
      return true;
    });
  }, [canSearch, companies, contacts, emails, token]);

  const commitEmail = (raw: string) => {
    const email = raw.trim().toLowerCase();
    if (!emailPattern.test(email)) return false;
    if (!emails.includes(email)) {
      onChange([...emails, email].join(", "));
    }
    setDraft("");
    setOpen(false);
    return true;
  };

  const removeEmail = (email: string) => {
    onChange(emails.filter((entry) => entry !== email).join(", "));
  };

  const handlePick = (suggestion: RecipientSuggestion) => {
    commitEmail(suggestion.email);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <Popover open={open && suggestions.length > 0} onOpenChange={setOpen} modal>
      <PopoverAnchor asChild>
        <div
          className={cn(
            "flex min-h-8 min-w-0 flex-wrap items-center gap-1 rounded-md border border-input bg-background px-1.5 py-1",
            disabled && "pointer-events-none opacity-60",
            className,
          )}
          onClick={() => inputRef.current?.focus()}
        >
          {emails.map((email) => (
            <span
              key={email}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-foreground"
            >
              <span className="truncate">{email}</span>
              <button
                type="button"
                className="shrink-0 rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                aria-label={`Remove ${email}`}
                disabled={disabled}
                onClick={(event) => {
                  event.stopPropagation();
                  removeEmail(email);
                }}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            id={id}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setOpen(true);
            }}
            onBlur={() => {
              if (draft.trim()) commitEmail(draft);
            }}
            onKeyDown={(event) => {
              if (event.key === "Backspace" && !draft && emails.length > 0) {
                event.preventDefault();
                removeEmail(emails[emails.length - 1]!);
                return;
              }
              if (event.key === "," || event.key === "Enter") {
                if (!draft.trim()) return;
                if (emailPattern.test(draft.trim())) {
                  event.preventDefault();
                  commitEmail(draft);
                }
              }
            }}
            onFocus={() => {
              if (canSearch && suggestions.length > 0) setOpen(true);
            }}
            placeholder={emails.length === 0 ? placeholder : undefined}
            disabled={disabled}
            spellCheck={false}
            autoComplete="off"
            className="min-w-[8rem] flex-1 border-0 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </PopoverAnchor>
      {open && suggestions.length > 0 ? (
        <PopoverContent
          align="start"
          sideOffset={6}
          className="w-[min(24rem,var(--radix-popover-trigger-width))] p-1"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <p className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Contacts & clients
          </p>
          <ul className="max-h-56 overflow-y-auto">
            {suggestions.map((suggestion) => (
              <li key={suggestion.id}>
                <button
                  type="button"
                  className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    handlePick(suggestion);
                  }}
                >
                  {suggestion.kind === "company" ? (
                    <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <UserRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {suggestion.label}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {suggestion.email}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </PopoverContent>
      ) : null}
    </Popover>
  );
};

// Keep validation helper exported for tests and callers.
export const recipientListIsValid = (value: string) =>
  isValidEmailList(parseEmailList(value));
