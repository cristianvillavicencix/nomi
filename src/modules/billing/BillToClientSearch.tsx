import { Check, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { useGetList } from "ra-core";
import type { Company, Contact } from "@/components/atomic-crm/types";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatContactName } from "@/modules/billing/billingUtils";

export type BillToSelection = {
  companyId?: number | null;
  contactId?: number | null;
  label: string;
  company?: Company | null;
  contact?: Contact | null;
};

type BillToClientSearchProps = {
  value: BillToSelection | null;
  onChange: (value: BillToSelection | null) => void;
  variant?: "default" | "inline";
  /** When set, shown in the trigger instead of `value.label` (e.g. `Contact | Company`). */
  formattedLabel?: string | null;
};

const contactDisplayName = (contact: Contact) =>
  formatContactName(contact) ??
  contact.email_jsonb?.[0]?.value ??
  `Contact #${contact.id}`;

export const BillToClientSearch = ({
  value,
  onChange,
  variant = "default",
  formattedLabel,
}: BillToClientSearchProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const companyFilter = useMemo(() => {
    const q = query.trim();
    return q ? { "name@ilike": q } : {};
  }, [query]);

  const contactFilter = useMemo(() => {
    const q = query.trim();
    if (!q) return {};
    return {
      "@or": {
        "first_name@ilike": q,
        "last_name@ilike": q,
      },
    };
  }, [query]);

  const { data: companies = [] } = useGetList<Company>("companies", {
    filter: companyFilter,
    pagination: { page: 1, perPage: 15 },
    sort: { field: "name", order: "ASC" },
  });

  const { data: contacts = [] } = useGetList<Contact>("contacts", {
    filter: contactFilter,
    pagination: { page: 1, perPage: 15 },
    sort: { field: "last_name", order: "ASC" },
  });

  const selectCompany = async (company: Company) => {
    onChange({
      companyId: Number(company.id),
      contactId: company.primary_contact_id
        ? Number(company.primary_contact_id)
        : null,
      label: company.name,
      company,
      contact: null,
    });
    setOpen(false);
  };

  const selectContact = (contact: Contact) => {
    const name = contactDisplayName(contact);
    onChange({
      companyId: contact.company_id ? Number(contact.company_id) : null,
      contactId: Number(contact.id),
      label: name,
      company: null,
      contact,
    });
    setOpen(false);
  };

  const triggerLabel =
    formattedLabel?.trim() || value?.label || "Search company or client name…";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {variant === "inline" ? (
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            className="flex w-full cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-left font-normal shadow-none outline-none focus-visible:ring-0"
          >
            <span
              className={cn(
                "min-w-0 truncate text-left",
                value
                  ? "font-medium text-blue-700 hover:underline"
                  : "text-slate-400",
              )}
            >
              {triggerLabel}
            </span>
            {!value ? (
              <ChevronsUpDown className="size-3.5 shrink-0 text-slate-400" />
            ) : null}
          </button>
        ) : (
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-auto min-h-10 w-full justify-between py-2 font-normal"
          >
            <span className="truncate text-left">{triggerLabel}</span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Company or client name…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>No clients found.</CommandEmpty>
            {companies.length > 0 ? (
              <CommandGroup heading="Companies">
                {companies.map((company) => (
                  <CommandItem
                    key={`company-${company.id}`}
                    value={`company-${company.id}`}
                    onSelect={() => selectCompany(company)}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4",
                        value?.companyId === company.id && !value.contactId
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                    {company.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {contacts.length > 0 ? (
              <CommandGroup heading="Contacts">
                {contacts.map((contact) => (
                  <CommandItem
                    key={`contact-${contact.id}`}
                    value={`contact-${contact.id}`}
                    onSelect={() => selectContact(contact)}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4",
                        value?.contactId === contact.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {contactDisplayName(contact)}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
