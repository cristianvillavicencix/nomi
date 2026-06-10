import { useMemo, useState, type ReactNode } from "react";
import {
  useGetList,
  useRefresh,
  type Identifier,
} from "ra-core";
import {
  Check,
  ChevronsUpDown,
  ExternalLink,
  Loader2,
  Star,
  UserPlus,
  X,
} from "lucide-react";
import { Link } from "react-router";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Contact } from "@/components/atomic-crm/types";
import { ContactFormDialog } from "@/lbs/contacts/ContactFormDialog";
import {
  getContactEmail,
  getContactFullName,
} from "@/lbs/clients/clientShowUtils";
import { getPersonShowPath } from "@/lbs/routing";

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

const contactCompanyLabel = (contact: Contact) =>
  contact.company_name?.trim() || "No company";

const SEARCH_THRESHOLD = 5;

type PrimaryContactReferenceCardProps = {
  mode: "create" | "edit";
  companyId?: Identifier;
  selectedContactId?: Identifier | null;
  /** FK on the company record (edit mode only). */
  savedPrimaryContactId?: Identifier | null;
  primaryContact?: Contact | null;
  onSelectContact: (contactId: Identifier) => void;
  onClearContact?: () => void;
};

export const PrimaryContactReferenceCard = ({
  mode,
  companyId,
  selectedContactId,
  savedPrimaryContactId,
  primaryContact,
  onSelectContact,
  onClearContact,
}: PrimaryContactReferenceCardProps) => {
  const refresh = useRefresh();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [newContactOpen, setNewContactOpen] = useState(false);
  const [optimisticContact, setOptimisticContact] = useState<Contact | null>(
    null,
  );
  const [globalSearch, setGlobalSearch] = useState("");
  const [pendingReassign, setPendingReassign] = useState<Contact | null>(null);

  const isCreate = mode === "create";
  const trimmedGlobalSearch = globalSearch.trim();

  const { data: companyContacts = [], isPending: companyContactsPending } =
    useGetList<Contact>(
      "contacts",
      {
        filter: { "company_id@eq": companyId! },
        pagination: { page: 1, perPage: 200 },
        sort: { field: "first_name", order: "ASC" },
      },
      {
        enabled: !isCreate && companyId != null && companyId !== "",
      },
    );

  const { data: globalContacts = [], isFetching: globalContactsFetching } =
    useGetList<Contact>(
      "contacts",
      {
        filter: { q: trimmedGlobalSearch },
        pagination: { page: 1, perPage: 20 },
        sort: { field: "last_name", order: "ASC" },
      },
      {
        enabled: isCreate && pickerOpen && trimmedGlobalSearch.length > 0,
      },
    );

  const contacts = useMemo(() => {
    if (isCreate) {
      return globalContacts;
    }

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
  }, [
    companyContacts,
    companyId,
    globalContacts,
    isCreate,
    optimisticContact,
    primaryContact,
  ]);

  const activeContact = useMemo(() => {
    if (selectedContactId == null) return undefined;
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
  }, [contacts, optimisticContact, primaryContact, selectedContactId]);

  const isPending = isCreate ? globalContactsFetching : companyContactsPending;
  const showSearch = isCreate || contacts.length > SEARCH_THRESHOLD;

  const displayName = activeContact
    ? getContactFullName(activeContact)
    : "No primary contact";
  const role = activeContact?.title?.trim() ?? "";
  const email = activeContact != null ? getContactEmail(activeContact) : "";
  const phone = pickPrimaryPhone(activeContact);
  const emailDisplay = email !== "—" ? email : "";

  const pickerTriggerLabel = isCreate
    ? trimmedGlobalSearch.length > 0
      ? "Search results"
      : "Search contacts by name or email…"
    : activeContact != null
      ? contactPickerLabel(activeContact)
      : contacts.length > 0
        ? "Select primary contact"
        : "No contacts yet";

  const openNewContact = () => {
    setPickerOpen(false);
    setPendingReassign(null);
    setNewContactOpen(true);
  };

  const requestSelectContact = (contact: Contact) => {
    if (isCreate && contact.company_id != null && contact.company_id !== "") {
      setPendingReassign(contact);
      return;
    }
    setPendingReassign(null);
    setOptimisticContact(contact);
    onSelectContact(contact.id);
    setPickerOpen(false);
    setGlobalSearch("");
  };

  const confirmReassign = () => {
    if (!pendingReassign?.id) return;
    setOptimisticContact(pendingReassign);
    onSelectContact(pendingReassign.id);
    setPendingReassign(null);
    setPickerOpen(false);
    setGlobalSearch("");
  };

  const clearSelection = () => {
    setPendingReassign(null);
    setOptimisticContact(null);
    onClearContact?.();
  };

  const renderPicker = (trigger: ReactNode) => (
    <Popover
      open={pickerOpen}
      onOpenChange={(open) => {
        setPickerOpen(open);
        if (!open) {
          setPendingReassign(null);
          setGlobalSearch("");
        }
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        className="w-[min(100vw-2rem,24rem)] p-0 sm:w-[var(--radix-popover-trigger-width)]"
        align="start"
      >
        <Command shouldFilter={!isCreate && showSearch}>
          {showSearch ? (
            <CommandInput
              placeholder={
                isCreate
                  ? "Search by name or email…"
                  : "Search contacts…"
              }
              value={isCreate ? globalSearch : undefined}
              onValueChange={isCreate ? setGlobalSearch : undefined}
            />
          ) : null}
          <CommandList>
            {isPending ? (
              <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading contacts…
              </div>
            ) : (
              <>
                {isCreate && trimmedGlobalSearch.length === 0 ? (
                  <CommandEmpty>
                    Type a name or email to search contacts.
                  </CommandEmpty>
                ) : contacts.length === 0 ? (
                  <CommandEmpty>
                    {isCreate
                      ? "No contacts match your search."
                      : "No contacts linked to this company."}
                  </CommandEmpty>
                ) : (
                  <CommandGroup
                    heading={isCreate ? "Contacts" : "Company contacts"}
                  >
                    {contacts.map((contact) => {
                      const isSelected =
                        selectedContactId != null &&
                        String(contact.id) === String(selectedContactId);
                      const isSavedPrimary =
                        !isCreate &&
                        savedPrimaryContactId != null &&
                        String(contact.id) === String(savedPrimaryContactId);
                      const name = getContactFullName(contact);
                      const contactEmail = getContactEmail(contact);

                      return (
                        <CommandItem
                          key={String(contact.id)}
                          value={`${name} ${contactEmail !== "—" ? contactEmail : ""} ${contactCompanyLabel(contact)}`.trim()}
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
                            {isCreate ? (
                              <p className="truncate text-xs text-muted-foreground">
                                {contactCompanyLabel(contact)}
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
                    <UserPlus className="mr-2 size-4" />
                    + New contact
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );

  if (isCreate && selectedContactId == null && !pendingReassign) {
    return (
      <>
        {renderPicker(
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start sm:w-auto"
          >
            Add primary contact (optional)
          </Button>,
        )}
        <ContactFormDialog
          open={newContactOpen}
          onOpenChange={setNewContactOpen}
          allowOrphanContact
          title="New primary contact"
          description="Creates a contact without a company. They will be linked when you save this company."
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
      </>
    );
  }

  return (
    <div className="space-y-3">
      {pendingReassign ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p>
            This contact belongs to{" "}
            <span className="font-medium">
              {contactCompanyLabel(pendingReassign)}
            </span>
            . Saving will move them to this company.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={confirmReassign}>
              Confirm
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setPendingReassign(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

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
          {isCreate && activeContact?.company_name ? (
            <p className="text-xs text-muted-foreground">
              Current company: {contactCompanyLabel(activeContact)}
            </p>
          ) : null}
        </div>
        {activeContact?.id != null ? (
          <Button asChild variant="ghost" size="icon" className="shrink-0">
            <Link
              to={getPersonShowPath(activeContact)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open contact profile"
            >
              <ExternalLink className="size-4" />
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {renderPicker(
          <Button
            type="button"
            variant="outline"
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
        {isCreate
          ? "Choose an existing contact or create a new one. Save the company form to link them as primary."
          : "Person details are edited in their contact profile — here you only choose who is primary. Save the company form to apply your selection."}
      </p>

      <ContactFormDialog
        open={newContactOpen}
        onOpenChange={setNewContactOpen}
        lockCompanyId={isCreate ? undefined : companyId}
        allowOrphanContact={isCreate}
        title="New primary contact"
        description={
          isCreate
            ? "Creates a contact without a company. They will be linked when you save this company."
            : "Creates a contact for this company. Save the company form to set them as primary."
        }
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
