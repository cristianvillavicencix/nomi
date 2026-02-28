import { difference, union } from "lodash";
import {
  type Identifier,
  RecordContextProvider,
  RecordRepresentation,
  useListContext,
  useTimeout,
} from "ra-core";
import { type MouseEvent, useCallback, useRef } from "react";
import { Link } from "react-router";
import { ReferenceField } from "@/components/admin/reference-field";
import { TextField } from "@/components/admin/text-field";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

import { Status } from "../misc/Status";
import type { Contact } from "../types";
import { Avatar } from "./Avatar";
import { formatUsPhoneDisplayFromAny, getPhoneHref } from "@/utils/phone";

const getPrimaryPhone = (contact: Contact) =>
  contact.phone_jsonb?.find((phone) => phone.number?.trim())?.number ?? "—";

const getPrimaryEmail = (contact: Contact) =>
  contact.email_jsonb?.find((email) => email.email?.trim())?.email ?? "—";

const PhoneText = ({ value }: { value: string }) => {
  const href = getPhoneHref(value);
  const displayValue = formatUsPhoneDisplayFromAny(value);

  if (!href) {
    return <span>{displayValue}</span>;
  }

  return (
    <a
      href={href}
      className="underline hover:no-underline"
      onClick={(event) => event.stopPropagation()}
    >
      {displayValue}
    </a>
  );
};

const ContactAddress = ({ contact }: { contact: Contact }) => {
  if (!contact.address?.trim()) {
    return <span>—</span>;
  }

  return <span title={contact.address}>{contact.address}</span>;
};

export const ContactListContent = () => {
  const {
    data: contacts,
    error,
    isPending,
    onToggleItem,
    onSelect,
    selectedIds,
  } = useListContext<Contact>();
  const lastSelected = useRef<Identifier | null>(null);

  // Handle shift+click to select a range of rows
  const handleToggleItem = useCallback(
    (id: Identifier, event: MouseEvent) => {
      if (!contacts) return;

      const ids = contacts.map((contact) => contact.id);
      const lastSelectedIndex = lastSelected.current
        ? ids.indexOf(lastSelected.current)
        : -1;

      if (event.shiftKey && lastSelectedIndex !== -1) {
        const index = ids.indexOf(id);
        const idsBetweenSelections = ids.slice(
          Math.min(lastSelectedIndex, index),
          Math.max(lastSelectedIndex, index) + 1,
        );

        const isClickedItemSelected = selectedIds?.includes(id);
        const newSelectedIds = isClickedItemSelected
          ? difference(selectedIds, idsBetweenSelections)
          : union(selectedIds, idsBetweenSelections);

        onSelect?.(newSelectedIds);
      } else {
        onToggleItem(id);
      }

      lastSelected.current = id;
    },
    [contacts, selectedIds, onSelect, onToggleItem],
  );

  if (isPending) {
    return <Skeleton className="w-full h-9" />;
  }

  if (error) {
    return null;
  }

  return (
    <div className="md:divide-y">
      {contacts.map((contact) => (
        <RecordContextProvider key={contact.id} value={contact}>
          <ContactItemContent
            contact={contact}
            handleToggleItem={handleToggleItem}
          />
        </RecordContextProvider>
      ))}

      {contacts.length === 0 && (
        <div className="p-4">
          <div className="text-muted-foreground">No contacts found</div>
        </div>
      )}
    </div>
  );
};

const ContactItemContent = ({
  contact,
  handleToggleItem,
}: {
  contact: Contact;
  handleToggleItem: (id: Identifier, event: MouseEvent) => void;
}) => {
  const { selectedIds } = useListContext<Contact>();

  return (
    <div className="flex flex-row items-center pl-2 pr-4 py-2 hover:bg-muted transition-colors first:rounded-t-xl last:rounded-b-xl">
      <div
        className="px-4 py-3 flex items-center cursor-pointer"
        onClick={(e) => handleToggleItem(contact.id, e)}
      >
        <Checkbox
          className="cursor-pointer"
          checked={selectedIds.includes(contact.id)}
        />
      </div>
      <Link
        to={`/contacts/${contact.id}/show`}
        className="flex-1 min-w-0"
      >
        <div className="flex min-w-0 items-center gap-4">
          <Avatar />
          <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.4fr)] md:items-center md:gap-4">
            <div className="min-w-0">
              <div className="truncate font-medium">
                {`${contact.first_name} ${contact.last_name ?? ""}`}
              </div>
              <div className="truncate text-sm text-muted-foreground">
                {contact.company_id != null ? (
                  <ReferenceField
                    source="company_id"
                    reference="companies"
                    link={false}
                  >
                    <TextField source="name" />
                  </ReferenceField>
                ) : (
                  "—"
                )}
              </div>
            </div>
            <div className="min-w-0 truncate text-sm text-muted-foreground">
              <PhoneText value={getPrimaryPhone(contact)} />
            </div>
            <div
              className="min-w-0 truncate text-sm text-muted-foreground"
              title={getPrimaryEmail(contact)}
            >
              {getPrimaryEmail(contact)}
            </div>
            <div className="min-w-0 truncate text-sm text-muted-foreground">
              <ContactAddress contact={contact} />
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
};

export const ContactListContentMobile = () => {
  const {
    data: contacts,
    error,
    isPending,
    refetch,
  } = useListContext<Contact>();
  const oneSecondHasPassed = useTimeout(1000);

  if (isPending) {
    if (!oneSecondHasPassed) {
      return null;
    }
    return (
      <>
        {[...Array(5)].map((_, index) => (
          <div
            key={index}
            className="flex flex-row items-center py-2 hover:bg-muted transition-colors first:rounded-t-xl last:rounded-b-xl"
          >
            <div className="flex flex-row gap-4 items-center mr-4">
              <Skeleton className="w-10 h-10 rounded-full" />
            </div>
            <div className="flex-1 min-w-0">
              <Skeleton className="w-32 h-5 mb-2" />
              <Skeleton className="w-48 h-4" />
            </div>
          </div>
        ))}
      </>
    );
  }

  if (error && !contacts) {
    return (
      <div className="p-4">
        <div className="text-center text-muted-foreground mb-4">
          Error loading contacts
        </div>
        <div className="text-center mt-2">
          <Button
            onClick={() => {
              refetch();
            }}
          >
            <RotateCcw />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="md:divide-y">
      {contacts.map((contact) => (
        <RecordContextProvider key={contact.id} value={contact}>
          <ContactItemContentMobile contact={contact} />
        </RecordContextProvider>
      ))}
      {contacts.length === 0 && (
        <div className="p-4">
          <div className="text-muted-foreground">No contacts found</div>
        </div>
      )}
    </div>
  );
};

const ContactItemContentMobile = ({ contact }: { contact: Contact }) => (
  <Link
    to={`/contacts/${contact.id}/show`}
    className="flex flex-row gap-4 items-center py-2 hover:bg-muted transition-colors"
  >
    <Avatar />
    <div className="flex flex-col grow justify-between">
      <div className="flex-1 min-w-0">
        <div className="flex justify-between">
          <div className="font-medium">
            <RecordRepresentation />
          </div>
          <Status status={contact.status} />
        </div>
        <div className="text-sm text-muted-foreground">
          <div className="flex flex-col gap-1">
            <span>
              {contact.company_id != null && (
                <ReferenceField
                  source="company_id"
                  reference="companies"
                  link={false}
                >
                  <TextField source="name" />
                </ReferenceField>
              )}
              {contact.company_id == null ? "—" : null}
            </span>
            <span className="truncate">
              <PhoneText value={getPrimaryPhone(contact)} />
            </span>
            <span className="truncate" title={getPrimaryEmail(contact)}>
              {getPrimaryEmail(contact)}
            </span>
            <span className="truncate">
              <ContactAddress contact={contact} />
            </span>
          </div>
        </div>
      </div>
    </div>
  </Link>
);
