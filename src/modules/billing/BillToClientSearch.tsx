import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useGetList } from "ra-core";
import type { Company, Contact } from "@/components/atomic-crm/types";
import { CompanyAvatar } from "@/components/atomic-crm/companies/CompanyAvatar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  FloatingFieldShell,
  floatingFieldControlClassName,
} from "@/components/ui/floating-field";
import {
  getCompanyPrimaryContactPhone,
  getContactPrimaryPhone,
} from "@/modules/billing/billingRecipientResolution";
import { formatContactName } from "@/modules/billing/billingUtils";
import {
  CompanyCreateDialog,
  type CompanyCreateDialogResult,
} from "@/modules/clients/CompanyCreateDialog";
import { entityInitials } from "@/modules/shared/entityPickerUi";
import { entitySearchPopoverClassName } from "@/modules/shared/referenceAutocompleteOptions";

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
  variant?: "default" | "inline" | "floating";
  /** Floating outline label (used when variant="floating"). */
  label?: string;
  /** When set, shown in the trigger instead of `value.label` (e.g. `Contact | Company`). */
  formattedLabel?: string | null;
  searchPlaceholder?: string;
  /** Offer “Create new account” when search has no match (default true). */
  allowCreateAccount?: boolean;
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
  (value.contactId == null ||
    value.contactId === value.company?.primary_contact_id);

const contactSelected = (value: BillToSelection | null, contactId: number) =>
  value?.contactId === contactId;

const selectionFromCompany = (company: Company): BillToSelection => ({
  companyId: Number(company.id),
  contactId: company.primary_contact_id
    ? Number(company.primary_contact_id)
    : null,
  label: company.name,
  company,
  contact: null,
});

const ContactRowAvatar = ({ name }: { name: string }) => (
  <Avatar className="size-6 shrink-0">
    <AvatarFallback className="text-[10px]">{entityInitials(name)}</AvatarFallback>
  </Avatar>
);

export const BillToClientSearch = ({
  value,
  onChange,
  variant = "default",
  label = "Client",
  formattedLabel,
  searchPlaceholder = DEFAULT_SEARCH_PLACEHOLDER,
  allowCreateAccount = true,
}: BillToClientSearchProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createInitialName, setCreateInitialName] = useState("");
  const isFloating = variant === "floating";
  const floatingActive = open || Boolean(value?.label?.trim());
  const anchorRef = useRef<HTMLDivElement>(null);
  const suppressCloseRef = useRef(false);

  const scheduleSuppressClose = useCallback(() => {
    suppressCloseRef.current = true;
    window.requestAnimationFrame(() => {
      suppressCloseRef.current = false;
    });
  }, []);

  const handleOpenChange = useCallback((next: boolean) => {
    if (!next && suppressCloseRef.current) return;
    setOpen(next);
    if (!next) setQuery("");
  }, []);

  const handleInteractOutside = useCallback((event: Event) => {
    const target = event.target;
    if (anchorRef.current?.contains(target as Node)) {
      event.preventDefault();
    }
  }, []);

  const listFilter = useMemo(() => {
    const q = query.trim();
    return q ? { q } : {};
  }, [query]);

  const { data: companies = [], isFetching: companiesFetching } =
    useGetList<Company>("companies", {
      filter: listFilter,
      pagination: { page: 1, perPage: 15 },
      sort: { field: "name", order: "ASC" },
    });

  const { data: contacts = [], isFetching: contactsFetching } =
    useGetList<Contact>("contacts", {
      filter: listFilter,
      pagination: { page: 1, perPage: 15 },
      sort: { field: "last_name", order: "ASC" },
    });

  const isFetching = companiesFetching || contactsFetching;
  const trimmedQuery = query.trim();
  const hasResults = companies.length > 0 || contacts.length > 0;

  const selectCompany = (company: Company) => {
    onChange(selectionFromCompany(company));
    setQuery("");
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
    setQuery("");
    setOpen(false);
  };

  const openCreateAccount = (initialName = "") => {
    setCreateInitialName(initialName);
    setCreateOpen(true);
    setOpen(false);
  };

  const handleAccountCreated = (result: CompanyCreateDialogResult) => {
    const company =
      result.company ??
      ({
        id: result.companyId,
        name: result.name,
        sector: result.sector ?? "",
        primary_contact_id: result.contactId ?? null,
      } as Company);
    onChange({
      companyId: Number(result.companyId),
      contactId: result.contactId != null ? Number(result.contactId) : null,
      label: result.name,
      company,
      contact: null,
    });
  };

  const clearSelection = () => {
    onChange(null);
    setQuery("");
    setOpen(true);
  };

  const resultsList = (
    <>
      {isFetching ? (
        <div className="px-3 py-5 text-center text-sm text-muted-foreground">
          Searching…
        </div>
      ) : (
        <>
          {!hasResults ? (
            <div className="px-3 py-5 text-center text-sm text-muted-foreground">
              {trimmedQuery
                ? "No clients found."
                : "Type a company or client name."}
            </div>
          ) : null}
          {companies.length > 0 ? (
            <div className="px-1 py-1">
              <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Accounts
              </p>
              <ul className="max-h-56 overflow-y-auto">
                {companies.map((company) => {
                  const selected = companySelected(value, Number(company.id));
                  const phone = getCompanyPrimaryContactPhone(company);
                  return (
                    <li key={`company-${company.id}`}>
                      <button
                        type="button"
                        onClick={() => selectCompany(company)}
                        className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left hover:bg-accent"
                      >
                        <CompanyAvatar record={company} width={25} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {company.name}
                          </p>
                          {phone ? (
                            <p className="truncate text-xs text-muted-foreground">
                              {phone}
                            </p>
                          ) : null}
                        </div>
                        {selected ? (
                          <Check className="size-4 shrink-0 text-primary" />
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          {contacts.length > 0 ? (
            <div className="px-1 py-1">
              <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Contacts
              </p>
              <ul className="max-h-56 overflow-y-auto">
                {contacts.map((contact) => {
                  const name = contactDisplayName(contact);
                  const selected = contactSelected(value, Number(contact.id));
                  const phone = getContactPrimaryPhone(contact);
                  const companyName = contact.company_name?.trim();
                  return (
                    <li key={`contact-${contact.id}`}>
                      <button
                        type="button"
                        onClick={() => selectContact(contact)}
                        className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left hover:bg-accent"
                      >
                        <ContactRowAvatar name={name} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{name}</p>
                          {companyName || phone ? (
                            <p className="truncate text-xs text-muted-foreground">
                              {[companyName, phone].filter(Boolean).join(" · ")}
                            </p>
                          ) : null}
                        </div>
                        {selected ? (
                          <Check className="size-4 shrink-0 text-primary" />
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          {allowCreateAccount ? (
            <div className="border-t p-1">
              <button
                type="button"
                onClick={() => openCreateAccount(trimmedQuery)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-primary hover:bg-accent"
              >
                <Plus className="size-4 shrink-0" />
                <span className="min-w-0 truncate">
                  {trimmedQuery
                    ? `Create "${trimmedQuery}" as new account`
                    : "Create new account"}
                </span>
              </button>
            </div>
          ) : null}
        </>
      )}
    </>
  );

  if (isFloating) {
    const displayValue = open
      ? query
      : formattedLabel?.trim() || value?.label || "";

    return (
      <>
        <Popover open={open} onOpenChange={handleOpenChange} modal={false}>
          <PopoverAnchor asChild>
            <div ref={anchorRef} className="w-full">
              <FloatingFieldShell
                active={floatingActive}
                label={label}
                required
              >
                <div className="flex w-full items-center gap-1 pr-2">
                  <input
                    value={displayValue}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setOpen(true);
                    }}
                    onFocus={() => {
                      // Dialog autofocus must not open suggestions — only clear
                      // for search after the user already selected a client.
                      if (value) setQuery("");
                    }}
                    onPointerDown={() => {
                      scheduleSuppressClose();
                      setOpen(true);
                    }}
                    placeholder=" "
                    className={cn(
                      floatingFieldControlClassName,
                      "min-w-0 flex-1",
                    )}
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={open}
                    aria-autocomplete="list"
                  />
                  {value ? (
                    <button
                      type="button"
                      aria-label="Clear client"
                      className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      onPointerDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                      onClick={(event) => {
                        event.preventDefault();
                        clearSelection();
                      }}
                    >
                      <X className="size-3.5" />
                    </button>
                  ) : (
                    <ChevronsUpDown
                      className="size-4 shrink-0 opacity-50"
                      aria-hidden
                    />
                  )}
                </div>
              </FloatingFieldShell>
            </div>
          </PopoverAnchor>
          <PopoverContent
            className={cn(
              entitySearchPopoverClassName,
              "w-[var(--radix-popover-trigger-width)] min-w-[min(100vw-2rem,28rem)] p-0",
            )}
            align="start"
            side="bottom"
            sideOffset={4}
            collisionPadding={12}
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
            onInteractOutside={handleInteractOutside}
            onPointerDownOutside={handleInteractOutside}
          >
            {resultsList}
          </PopoverContent>
        </Popover>

        {allowCreateAccount ? (
          <CompanyCreateDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            initialCompanyName={createInitialName}
            enableDraft={false}
            onUseExistingCompany={selectCompany}
            onCreated={handleAccountCreated}
          />
        ) : null}
      </>
    );
  }

  const triggerLabel =
    formattedLabel?.trim() || value?.label || searchPlaceholder;

  const trigger =
    variant === "inline" ? (
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
    );

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
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
              {isFetching ? (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Searching…
                </div>
              ) : (
                <>
                  {!hasResults ? (
                    <CommandEmpty>
                      {trimmedQuery
                        ? "No clients found."
                        : "Type a company or client name."}
                    </CommandEmpty>
                  ) : null}
                  {companies.length > 0 ? (
                    <CommandGroup heading="Accounts">
                      {companies.map((company) => {
                        const selected = companySelected(
                          value,
                          Number(company.id),
                        );
                        const phone = getCompanyPrimaryContactPhone(company);
                        return (
                          <CommandItem
                            key={`company-${company.id}`}
                            value={`company-${company.id}`}
                            onSelect={() => selectCompany(company)}
                            className="items-center gap-2.5"
                          >
                            <CompanyAvatar record={company} width={25} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">
                                {company.name}
                              </p>
                              {phone ? (
                                <p className="truncate text-xs text-muted-foreground">
                                  {phone}
                                </p>
                              ) : null}
                            </div>
                            {selected ? (
                              <Check className="size-4 shrink-0" />
                            ) : null}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  ) : null}
                  {contacts.length > 0 ? (
                    <CommandGroup heading="Contacts">
                      {contacts.map((contact) => {
                        const name = contactDisplayName(contact);
                        const selected = contactSelected(
                          value,
                          Number(contact.id),
                        );
                        const phone = getContactPrimaryPhone(contact);
                        const companyName = contact.company_name?.trim();
                        return (
                          <CommandItem
                            key={`contact-${contact.id}`}
                            value={`contact-${contact.id}`}
                            onSelect={() => selectContact(contact)}
                            className="items-center gap-2.5"
                          >
                            <ContactRowAvatar name={name} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{name}</p>
                              {companyName || phone ? (
                                <p className="truncate text-xs text-muted-foreground">
                                  {[companyName, phone]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </p>
                              ) : null}
                            </div>
                            {selected ? (
                              <Check className="size-4 shrink-0" />
                            ) : null}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  ) : null}
                  {allowCreateAccount ? (
                    <CommandGroup>
                      <CommandItem
                        value={`create-account-${trimmedQuery || "new"}`}
                        onSelect={() => openCreateAccount(trimmedQuery)}
                        className="gap-2 text-primary"
                      >
                        <Plus className="size-4 shrink-0" />
                        <span className="min-w-0 truncate">
                          {trimmedQuery
                            ? `Create "${trimmedQuery}" as new account`
                            : "Create new account"}
                        </span>
                      </CommandItem>
                    </CommandGroup>
                  ) : null}
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {allowCreateAccount ? (
        <CompanyCreateDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          initialCompanyName={createInitialName}
          enableDraft={false}
          onUseExistingCompany={selectCompany}
          onCreated={handleAccountCreated}
        />
      ) : null}
    </>
  );
};
