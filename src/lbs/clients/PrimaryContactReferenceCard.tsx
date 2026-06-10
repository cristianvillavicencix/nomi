import { useMemo, useState } from "react";
import { useGetList, type Identifier } from "ra-core";
import { ExternalLink, UserPlus } from "lucide-react";
import { Link } from "react-router";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Contact } from "@/components/atomic-crm/types";
import { ContactFormDialog } from "@/lbs/contacts/ContactFormDialog";
import { getContactFullName } from "@/lbs/clients/clientShowUtils";
import { getPersonShowPath } from "@/lbs/routing";

const pickPrimaryEmail = (contact?: Contact | null) =>
  contact?.email_jsonb?.find((e) => e.email?.trim())?.email?.trim() ?? "";

const pickPrimaryPhone = (contact?: Contact | null) =>
  contact?.phone_jsonb?.find((p) => p.number?.trim())?.number?.trim() ?? "";

const initials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
};

type PrimaryContactReferenceCardProps = {
  companyId: Identifier;
  selectedContactId?: Identifier | null;
  primaryContact?: Contact | null;
  onSelectContact: (contactId: Identifier) => void;
};

export const PrimaryContactReferenceCard = ({
  companyId,
  selectedContactId,
  primaryContact,
  onSelectContact,
}: PrimaryContactReferenceCardProps) => {
  const [newContactOpen, setNewContactOpen] = useState(false);

  const { data: companyContacts = [] } = useGetList<Contact>(
    "contacts",
    {
      filter: { "company_id@eq": companyId },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "first_name", order: "ASC" },
    },
    { enabled: companyId != null },
  );

  const activeContact = useMemo(() => {
    if (primaryContact && String(primaryContact.id) === String(selectedContactId)) {
      return primaryContact;
    }
    return companyContacts.find(
      (c) => String(c.id) === String(selectedContactId),
    );
  }, [companyContacts, primaryContact, selectedContactId]);

  const displayName = activeContact
    ? getContactFullName(activeContact)
    : "No primary contact";
  const role = activeContact?.title?.trim() ?? "";
  const email = pickPrimaryEmail(activeContact);
  const phone = pickPrimaryPhone(activeContact);

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
            {[email, phone].filter(Boolean).join(" · ") || "No email or phone"}
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

      <div className="flex flex-wrap gap-2">
        <Select
          value={selectedContactId != null ? String(selectedContactId) : ""}
          onValueChange={(value) => {
            if (value === "__new__") {
              setNewContactOpen(true);
              return;
            }
            onSelectContact(value);
          }}
        >
          <SelectTrigger className="w-full sm:w-[min(100%,20rem)]">
            <SelectValue placeholder="Change primary contact" />
          </SelectTrigger>
          <SelectContent>
            {companyContacts.map((contact) => (
              <SelectItem key={String(contact.id)} value={String(contact.id)}>
                {getContactFullName(contact)}
              </SelectItem>
            ))}
            <SelectItem value="__new__">
              <span className="flex items-center gap-2">
                <UserPlus className="size-4" />
                New contact
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground">
        Person details are edited in their contact profile — here you only
        choose who it is.
      </p>

      <ContactFormDialog
        open={newContactOpen}
        onOpenChange={setNewContactOpen}
        lockCompanyId={companyId}
        title="New primary contact"
        description="Creates a contact for this company and sets them as primary."
        submitLabel="Create and assign"
        navigateOnCreate={false}
        onCreated={(contact) => {
          if (contact.id != null) {
            onSelectContact(contact.id);
          }
        }}
      />
    </div>
  );
};
