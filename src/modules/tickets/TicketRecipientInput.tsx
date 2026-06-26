import { Building2, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { useGetList } from "ra-core";
import type { Company, Contact } from "@/components/atomic-crm/types";
import {
  getContactEmail,
  getContactFullName,
} from "@/modules/clients/clientShowUtils";
import { parseEmailList } from "@/modules/tickets/ticketReplySignature";
import { Input } from "@/components/ui/input";
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

const splitRecipientToken = (value: string) => {
  const lastComma = value.lastIndexOf(",");
  const token = (lastComma === -1 ? value : value.slice(lastComma + 1)).trim();
  const base =
    lastComma === -1
      ? ""
      : value.slice(0, lastComma).trim().replace(/,\s*$/, "");
  return { token, base };
};

const applyRecipientEmail = (value: string, email: string) => {
  const normalized = email.trim().toLowerCase();
  const existing = parseEmailList(value);
  if (existing.includes(normalized)) {
    return existing.join(", ");
  }

  const { token, base } = splitRecipientToken(value);
  if (!base && !token) return normalized;
  if (!base) return normalized;
  if (token) return `${base}, ${normalized}`;
  return `${base}, ${normalized}`;
};

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
  const [open, setOpen] = useState(false);
  const { token } = splitRecipientToken(value);
  const canSearch = token.length >= 2;

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

    const seen = new Set<string>();
    return items.filter((item) => {
      if (seen.has(item.email)) return false;
      seen.add(item.email);
      return true;
    });
  }, [canSearch, companies, contacts, token]);

  const handlePick = (suggestion: RecipientSuggestion) => {
    onChange(applyRecipientEmail(value, suggestion.email));
    setOpen(false);
  };

  return (
    <Popover open={open && suggestions.length > 0} onOpenChange={setOpen} modal>
      <PopoverAnchor asChild>
        <Input
          id={id}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (canSearch && suggestions.length > 0) setOpen(true);
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "h-7 min-w-[10rem] flex-1 border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-0",
            className,
          )}
        />
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
