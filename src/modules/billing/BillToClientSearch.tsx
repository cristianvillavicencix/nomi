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
import {
  getCompanyPrimaryContactPhone,
  getContactPrimaryPhone,
} from "@/modules/billing/billingRecipientResolution";
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
  searchPlaceholder?: string;
};

const DEFAULT_SEARCH_PLACEHOLDER = "Company or client name…";

const contactDisplayName = (contact: Contact) =>
  formatContactName(contact) ??
  contact.email_jsonb?.[0]?.value ??
  `Contact #${contact.id}`;

const companySelected = (
  value: BillToSelection | null,
  companyId: number,
) =>
  value?.companyId === companyId &&
  (value.contactId == null || value.contactId === value.company?.primary_contact_id);

const contactSelected = (value: BillToSelection | null, contactId: number) =>
  value?.contactId === contactId;

export const BillToClientSearch = ({
  value,
  onChange,
  variant = "default",
  formattedLabel,
  searchPlaceholder = DEFAULT_SEARCH_PLACEHOLDER,
}: BillToClientSearchProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const listFilter = useMemo(() => {
    const q = query.trim();
    return q ? { q } : {};
  }, [query]);

  const { data: companies = [] } = useGetList<Company>("companies", {
    filter: listFilter,
    pagination: { page: 1, perPage: 15 },
    sort: { field: "name", order: "ASC" },
  });

  const { data: contacts = [] } = useGetList<Contact>("contacts", {
    filter: listFilter,
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
    formattedLabel?.trim() || value?.label || searchPlaceholder;

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
                  ? "font-medium text-primary hover:underline"
                  : "text-muted-foreground",
              )}
            >
              {triggerLabel}
            </span>
            {!value ? (
              <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
            ) : null}
          </button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            role="combobox"
            aria-expanded={open}
            className="h-auto min-h-10 w-full justify-between py-2 font-normal"
          >
            <span className="truncate text-left">{triggerLabel}</span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[min(100vw-2rem,28rem)] p-0"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>No clients found.</CommandEmpty>
            {companies.length > 0 ? (
              <CommandGroup heading="Companies">
                {companies.map((company) => {
                  const selected = companySelected(value, Number(company.id));
                  const phone = getCompanyPrimaryContactPhone(company);
                  return (
                    <CommandItem
                      key={`company-${company.id}`}
                      value={`company-${company.id}`}
                      onSelect={() => selectCompany(company)}
                      className="items-start gap-2"
                    >
                      {selected ? (
                        <Check className="mt-0.5 size-4 shrink-0" />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{company.name}</p>
                        {phone ? (
                          <p className="truncate text-xs text-muted-foreground">
                            {phone}
                          </p>
                        ) : null}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ) : null}
            {contacts.length > 0 ? (
              <CommandGroup heading="Contacts">
                {contacts.map((contact) => {
                  const selected = contactSelected(value, Number(contact.id));
                  const phone = getContactPrimaryPhone(contact);
                  const companyName = contact.company_name?.trim();
                  return (
                    <CommandItem
                      key={`contact-${contact.id}`}
                      value={`contact-${contact.id}`}
                      onSelect={() => selectContact(contact)}
                      className="items-start gap-2"
                    >
                      {selected ? (
                        <Check className="mt-0.5 size-4 shrink-0" />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {contactDisplayName(contact)}
                        </p>
                        {companyName || phone ? (
                          <p className="truncate text-xs text-muted-foreground">
                            {[companyName, phone].filter(Boolean).join(" · ")}
                          </p>
                        ) : null}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
