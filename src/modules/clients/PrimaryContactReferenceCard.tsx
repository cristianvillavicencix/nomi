import { useMemo, useState, type ReactNode } from "react";
import { useGetList, useRefresh, type Identifier } from "ra-core";
import {
  Check,
  ChevronsUpDown,
  ExternalLink,
  Loader2,
  Plus,
  Search,
  Star,
  X,
} from "lucide-react";
import { Link } from "react-router";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { entitySearchPopoverClassName } from "@/modules/shared/referenceAutocompleteOptions";
import type { Contact } from "@/components/atomic-crm/types";
import { ContactFormDialog } from "@/modules/contacts/ContactFormDialog";
import {
  getContactEmail,
  getContactFullName} from "@/modules/clients/clientShowUtils";
import type { PrimaryContactDraft } from "@/modules/clients/primaryContactDraft";
import { getPersonShowPath } from "@/app/routing";
import {
  EntitySearchGroup,
  EntitySearchOption,
  EntitySearchToolbar,
  SelectedEntityRow} from "@/modules/shared/entityPickerUi";
import { buildContactSearchMeta } from "@/modules/shared/referenceAutocompleteOptions";

const pickPrimaryPhone = (contact?: Contact | null) =>
  contact?.phone_jsonb?.find((p) => p.number?.trim())?.number?.trim() ?? "";

const initials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
};

const contactPickerLabel = (contact: Contact) => {
  const name = getContactFullName(contact);
  const email = getContactEmail(contact);
  return email !== "—" ? `${name} · ${email}` : name;
};

const isUnassignedContact = (contact: Pick<Contact, "company_id">) =>
  contact.company_id == null || contact.company_id === "";

const SEARCH_THRESHOLD = 5;

const UNASSIGNED_CONTACT_FILTER = { "company_id@is": null } as const;

type PrimaryContactReferenceCardProps = {
  mode: "create" | "edit";
  companyId?: Identifier;
  selectedContactId?: Identifier | null;
  /** FK on the company record (edit mode only). */
  savedPrimaryContactId?: Identifier | null;
  primaryContact?: Contact | null;
  /** Local-only primary contact draft (create mode — not persisted until company save). */
  draftPrimaryContact?: PrimaryContactDraft | null;
  onSelectContact: (contactId: Identifier) => void;
  onSelectDraftContact?: (draft: PrimaryContactDraft) => void;
  onClearContact?: () => void;
};

const SelectedPrimaryContactRow = ({
  name,
  email,
  phone,
  profileHref,
  onRemove}: {
  name: string;
  email: string;
  phone: string;
  profileHref?: string;
  onRemove: () => void;
}) => (
  <SelectedEntityRow
    title={name}
    subtitle={[email, phone].filter(Boolean).join(" · ") || "No email or phone"}
    profileHref={profileHref}
    onRemove={onRemove}
    removeAriaLabel="Remove primary contact"
  />
);

const CreatePrimaryContactPicker = ({
  selectedContactId,
  draftPrimaryContact,
  onSelectContact,
  onSelectDraftContact,
  onClearContact}: Pick<
  PrimaryContactReferenceCardProps,
  | "selectedContactId"
  | "draftPrimaryContact"
  | "onSelectContact"
  | "onSelectDraftContact"
  | "onClearContact"
>) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [newContactOpen, setNewContactOpen] = useState(false);
  const [optimisticContact, setOptimisticContact] = useState<Contact | null>(
    null,
  );

  const trimmedSearch = searchQuery.trim();
  const shouldFetchUnassigned =
    searchOpen && (trimmedSearch.length > 0 || searchOpen);

  const { data: unassignedContacts = [], isFetching } = useGetList<Contact>(
    "contacts",
    {
      filter: {
        ...UNASSIGNED_CONTACT_FILTER,
        ...(trimmedSearch ? { q: trimmedSearch } : {})},
      pagination: { page: 1, perPage: 20 },
      sort: { field: "last_name", order: "ASC" }},
    { enabled: shouldFetchUnassigned },
  );

  const contacts = useMemo(
    () => unassignedContacts.filter(isUnassignedContact),
    [unassignedContacts],
  );

  const activeContact = useMemo(() => {
    if (draftPrimaryContact?.fullName.trim()) {
      const parts = draftPrimaryContact.fullName.trim().split(/\s+/);
      return {
        first_name: parts[0] ?? "",
        last_name: parts.slice(1).join(" ") || parts[0] || "",
        email_jsonb: draftPrimaryContact.email
          ? [{ email: draftPrimaryContact.email, type: "Work" as const }]
          : [],
        phone_jsonb: draftPrimaryContact.phone
          ? [{ number: draftPrimaryContact.phone, type: "Work" as const }]
          : []} satisfies Partial<Contact> as Contact;
    }
    if (selectedContactId == null) return undefined;
    if (
      optimisticContact &&
      String(optimisticContact.id) === String(selectedContactId)
    ) {
      return optimisticContact;
    }
    return contacts.find((c) => String(c.id) === String(selectedContactId));
  }, [contacts, draftPrimaryContact, optimisticContact, selectedContactId]);

  const hasSelection = selectedContactId != null || draftPrimaryContact != null;

  const rowName = activeContact ? getContactFullName(activeContact) : "";
  const rowEmail = activeContact != null ? getContactEmail(activeContact) : "";
  const rowEmailDisplay = rowEmail !== "—" ? rowEmail : "";
  const rowPhone = pickPrimaryPhone(activeContact);

  const selectContact = (contact: Contact) => {
    setOptimisticContact(contact);
    onSelectContact(contact.id);
    setSearchOpen(false);
    setSearchQuery("");
  };

  const clearSelection = () => {
    setOptimisticContact(null);
    onClearContact?.();
  };

  return (
    <div className="space-y-3">
      <EntitySearchToolbar
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        searchOpen={searchOpen}
        onSearchOpenChange={setSearchOpen}
        searchPlaceholder="Search unassigned contacts…"
        addButtonLabel="Add contact"
        addButtonIcon={<Plus className="size-4" />}
        onAddClick={() => setNewContactOpen(true)}
        isFetching={isFetching}
        emptyMessage="No unassigned contacts found."
        emptySearchMessage="No unassigned contacts match your search."
        groupHeading="Unassigned contacts"
      >
        {!isFetching ? (
          contacts.length === 0 ? (
            <CommandEmpty>
              {trimmedSearch
                ? "No unassigned contacts match your search."
                : "No unassigned contacts found."}
            </CommandEmpty>
          ) : (
            <EntitySearchGroup heading="Unassigned contacts">
              {contacts.map((contact) => {
                const name = getContactFullName(contact);
                const isSelected =
                  selectedContactId != null &&
                  String(contact.id) === String(selectedContactId);

                return (
                  <EntitySearchOption
                    key={String(contact.id)}
                    label={name}
                    sublabel={buildContactSearchMeta(contact) || undefined}
                    selected={isSelected}
                    onSelect={() => selectContact(contact)}
                  />
                );
              })}
            </EntitySearchGroup>
          )
        ) : null}
      </EntitySearchToolbar>

      {hasSelection && activeContact ? (
        <SelectedPrimaryContactRow
          name={rowName}
          email={rowEmailDisplay}
          phone={rowPhone}
          profileHref={
            activeContact.id != null
              ? getPersonShowPath(activeContact)
              : undefined
          }
          onRemove={clearSelection}
        />
      ) : null}

      <p className="text-xs text-muted-foreground">
        Only contacts without a company are listed. Save the company form to
        link your selection as primary.
      </p>

      <ContactFormDialog
        open={newContactOpen}
        onOpenChange={setNewContactOpen}
        deferCreate
        title="New contact"
        description="Contact details are saved with the company — nothing is written until you create the company."
        submitLabel="Add contact"
        onDraftSubmit={(draft) => {
          onSelectDraftContact?.(draft);
        }}
      />
    </div>
  );
};

export const PrimaryContactReferenceCard = ({
  mode,
  companyId,
  selectedContactId,
  savedPrimaryContactId,
  primaryContact,
  draftPrimaryContact,
  onSelectContact,
  onSelectDraftContact,
  onClearContact}: PrimaryContactReferenceCardProps) => {
  const refresh = useRefresh();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [newContactOpen, setNewContactOpen] = useState(false);
  const [optimisticContact, setOptimisticContact] = useState<Contact | null>(
    null,
  );

  const isCreate = mode === "create";

  const { data: companyContacts = [], isPending: companyContactsPending } =
    useGetList<Contact>(
      "contacts",
      {
        filter: { "company_id@eq": companyId! },
        pagination: { page: 1, perPage: 200 },
        sort: { field: "first_name", order: "ASC" }},
      {
        enabled: !isCreate && companyId != null && companyId !== ""},
    );

  const contacts = useMemo(() => {
    if (isCreate) return [];
    const byId = new Map<string, Contact>();
    for (const contact of companyContacts) {
      byId.set(String(contact.id), contact);
    }
    if (
      optimisticContact?.id != null &&
      companyId != null &&
      String(optimisticContact.company_id) === String(companyId)
    ) {
      byId.set(String(optimisticContact.id), optimisticContact);
    }
    if (
      primaryContact?.id != null &&
      companyId != null &&
      String(primaryContact.company_id) === String(companyId)
    ) {
      byId.set(String(primaryContact.id), primaryContact);
    }
    return [...byId.values()].sort((left, right) =>
      getContactFullName(left).localeCompare(getContactFullName(right)),
    );
  }, [companyContacts, companyId, isCreate, optimisticContact, primaryContact]);

  const activeContact = useMemo(() => {
    if (isCreate || selectedContactId == null) return undefined;
    if (
      primaryContact &&
      String(primaryContact.id) === String(selectedContactId)
    ) {
      return primaryContact;
    }
    if (
      optimisticContact &&
      String(optimisticContact.id) === String(selectedContactId)
    ) {
      return optimisticContact;
    }
    return contacts.find((c) => String(c.id) === String(selectedContactId));
  }, [
    contacts,
    isCreate,
    optimisticContact,
    primaryContact,
    selectedContactId,
  ]);

  if (isCreate) {
    return (
      <CreatePrimaryContactPicker
        selectedContactId={selectedContactId}
        draftPrimaryContact={draftPrimaryContact}
        onSelectContact={onSelectContact}
        onSelectDraftContact={onSelectDraftContact}
        onClearContact={onClearContact}
      />
    );
  }

  const isPending = companyContactsPending;
  const showSearch = contacts.length > SEARCH_THRESHOLD;

  const displayName = activeContact
    ? getContactFullName(activeContact)
    : "No primary contact";
  const role = activeContact?.title?.trim() ?? "";
  const email = activeContact != null ? getContactEmail(activeContact) : "";
  const phone = pickPrimaryPhone(activeContact);
  const emailDisplay = email !== "—" ? email : "";

  const pickerTriggerLabel =
    activeContact != null
      ? contactPickerLabel(activeContact)
      : contacts.length > 0
        ? "Select primary contact"
        : "No contacts yet";

  const openNewContact = () => {
    setPickerOpen(false);
    setNewContactOpen(true);
  };

  const requestSelectContact = (contact: Contact) => {
    setOptimisticContact(contact);
    onSelectContact(contact.id);
    setPickerOpen(false);
  };

  const clearSelection = () => {
    setOptimisticContact(null);
    onClearContact?.();
  };

  const renderPicker = (trigger: ReactNode) => (
    <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className={entitySearchPopoverClassName} align="start">
        <Command shouldFilter={showSearch}>
          {showSearch ? <CommandInput placeholder="Search contacts…" /> : null}
          <CommandList>
            {isPending ? (
              <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading contacts…
              </div>
            ) : (
              <>
                {contacts.length === 0 ? (
                  <CommandEmpty>
                    No contacts linked to this company.
                  </CommandEmpty>
                ) : (
                  <CommandGroup heading="Company contacts">
                    {contacts.map((contact) => {
                      const isSelected =
                        selectedContactId != null &&
                        String(contact.id) === String(selectedContactId);
                      const isSavedPrimary =
                        savedPrimaryContactId != null &&
                        String(contact.id) === String(savedPrimaryContactId);
                      const name = getContactFullName(contact);
                      const contactEmail = getContactEmail(contact);

                      return (
                        <CommandItem
                          key={String(contact.id)}
                          value={`${name} ${contactEmail !== "—" ? contactEmail : ""}`.trim()}
                          onSelect={() => requestSelectContact(contact)}
                        >
                          <Check
                            className={cn(
                              "mr-2 size-4 shrink-0",
                              isSelected ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate font-medium">
                                {name}
                              </span>
                              {isSavedPrimary ? (
                                <Badge
                                  variant="secondary"
                                  className="h-5 gap-1 px-1.5 text-[10px] font-normal"
                                >
                                  <Star className="size-3 fill-current" />
                                  Primary
                                </Badge>
                              ) : null}
                            </div>
                            {contactEmail !== "—" ? (
                              <p className="truncate text-xs text-muted-foreground">
                                {contactEmail}
                              </p>
                            ) : null}
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                )}
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value="__new_contact__"
                    onSelect={openNewContact}
                    className="font-medium"
                  >
                    <Plus className="mr-2 size-4" />
                    New contact
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 rounded-lg border bg-muted/20 p-4">
        <Avatar className="size-10">
          <AvatarFallback>{initials(displayName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium leading-tight">{displayName}</p>
          {role ? (
            <p className="text-sm text-muted-foreground">{role}</p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {[emailDisplay, phone].filter(Boolean).join(" · ") ||
              "No email or phone"}
          </p>
        </div>
        {activeContact?.id != null ? (
          <IconButton aria-label="Open link" asChild className="shrink-0">
            <Link
              to={getPersonShowPath(activeContact)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open contact profile"
            >
              <ExternalLink className="size-4" />
            </Link>
          </IconButton>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {renderPicker(
          <Button
            type="button"
            variant="secondary"
            role="combobox"
            aria-expanded={pickerOpen}
            className="h-auto min-h-9 min-w-[12rem] flex-1 justify-between py-2 font-normal sm:flex-none sm:w-[min(100%,24rem)]"
          >
            <span className="truncate text-left">
              {activeContact ? "Change contact" : pickerTriggerLabel}
            </span>
            {isPending ? (
              <Loader2 className="ml-2 size-4 shrink-0 animate-spin opacity-60" />
            ) : (
              <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
            )}
          </Button>,
        )}
        {selectedContactId != null ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1"
            onClick={clearSelection}
          >
            <X className="size-4" />
            Remove
          </Button>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        Person details are edited in their contact profile — here you only
        choose who is primary. Save the company form to apply your selection.
      </p>

      <ContactFormDialog
        open={newContactOpen}
        onOpenChange={setNewContactOpen}
        lockCompanyId={companyId}
        title="New primary contact"
        description="Creates a contact for this company. Save the company form to set them as primary."
        submitLabel="Create contact"
        navigateOnCreate={false}
        onCreated={(contact) => {
          if (contact.id != null) {
            setOptimisticContact(contact);
            onSelectContact(contact.id);
            refresh();
          }
        }}
      />
    </div>
  );
};
