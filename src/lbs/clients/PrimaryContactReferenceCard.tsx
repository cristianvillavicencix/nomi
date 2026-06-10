import { useMemo, useState } from "react";
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

const SEARCH_THRESHOLD = 5;

type PrimaryContactReferenceCardProps = {
  companyId: Identifier;
  selectedContactId?: Identifier | null;
  /** FK on the company record (may differ from selection until save). */
  savedPrimaryContactId?: Identifier | null;
  primaryContact?: Contact | null;
  onSelectContact: (contactId: Identifier) => void;
};

export const PrimaryContactReferenceCard = ({
  companyId,
  selectedContactId,
  savedPrimaryContactId,
  primaryContact,
  onSelectContact,
}: PrimaryContactReferenceCardProps) => {
  const refresh = useRefresh();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [newContactOpen, setNewContactOpen] = useState(false);
  const [optimisticContact, setOptimisticContact] = useState<Contact | null>(
    null,
  );

  const { data: companyContacts = [], isPending } = useGetList<Contact>(
    "contacts",
    {
      filter: { "company_id@eq": companyId },
      pagination: { page: 1, perPage: 200 },
      sort: { field: "first_name", order: "ASC" },
    },
    { enabled: companyId != null && companyId !== "" },
  );

  const contacts = useMemo(() => {
    const byId = new Map<string, Contact>();
    for (const contact of companyContacts) {
      byId.set(String(contact.id), contact);
    }
    if (
      optimisticContact?.id != null &&
      String(optimisticContact.company_id) === String(companyId)
    ) {
      byId.set(String(optimisticContact.id), optimisticContact);
    }
    if (
      primaryContact?.id != null &&
      String(primaryContact.company_id) === String(companyId)
    ) {
      byId.set(String(primaryContact.id), primaryContact);
    }
    return [...byId.values()].sort((left, right) =>
      getContactFullName(left).localeCompare(getContactFullName(right)),
    );
  }, [companyContacts, companyId, optimisticContact, primaryContact]);

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

  const displayName = activeContact
    ? getContactFullName(activeContact)
    : "No primary contact";
  const role = activeContact?.title?.trim() ?? "";
  const email =
    activeContact != null ? getContactEmail(activeContact) : "";
  const phone = pickPrimaryPhone(activeContact);
  const emailDisplay = email !== "—" ? email : "";
  const showSearch = contacts.length > SEARCH_THRESHOLD;

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

      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={pickerOpen}
            className="h-auto min-h-9 w-full justify-between py-2 font-normal sm:w-[min(100%,24rem)]"
          >
            <span className="truncate text-left">{pickerTriggerLabel}</span>
            {isPending ? (
              <Loader2 className="ml-2 size-4 shrink-0 animate-spin opacity-60" />
            ) : (
              <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
        >
          <Command shouldFilter={showSearch}>
            {showSearch ? (
              <CommandInput placeholder="Search contacts…" />
            ) : null}
            <CommandList>
              {isPending ? (
                <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading contacts…
                </div>
              ) : (
                <>
                  {contacts.length === 0 ? (
                    <CommandEmpty>No contacts linked to this company.</CommandEmpty>
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
                            onSelect={() => {
                              onSelectContact(contact.id);
                              setPickerOpen(false);
                            }}
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
