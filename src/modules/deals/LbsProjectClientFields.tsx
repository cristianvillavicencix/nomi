import { useCallback, useEffect, useRef, useState } from "react";
import { required, useGetOne, type Identifier } from "ra-core";
import { Mail, Phone } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { AutocompleteCompanyInput } from "@/components/atomic-crm/companies/AutocompleteCompanyInput";
import { getPersonShowPath } from "@/app/routing";
import type { Contact, Deal } from "@/components/atomic-crm/types";
import {
  getContactEmail,
  getContactFullName,
  getContactPhone,
} from "@/modules/clients/clientShowUtils";
import { ContactFormDialog } from "@/modules/contacts/ContactFormDialog";
import { lbsProjectContactName } from "@/modules/deals/LbsProjectContactOption";
import { CreateFormSectionLabel } from "@/modules/shared/createForm/CreateFormLayout";
import { SelectedEntityRow } from "@/modules/shared/entityPickerUi";
import { isValidRecordId } from "@/lib/isValidRecordId";

type ContactCreateDefaults = {
  contactName?: string;
};

const buildContactCreateDefaults = (contactName?: string) => {
  const trimmed = contactName?.trim() ?? "";
  if (!trimmed) return undefined;
  const parts = trimmed.split(/\s+/).filter(Boolean);
  return {
    first_name: parts[0] ?? "",
    last_name: parts.slice(1).join(" "),
  };
};

type PendingClientCreate = {
  resolve: (record?: Contact) => void;
};

const toAutocompleteContact = (
  contactId: Identifier,
  companyName: string,
  contact?: Partial<Contact> | null,
): Contact => {
  const fullName = contact ? getContactFullName(contact as Contact) : "";
  const parts = fullName.split(/\s+/).filter(Boolean);
  return {
    id: contactId,
    first_name: contact?.first_name ?? parts[0] ?? "",
    last_name: contact?.last_name ?? parts.slice(1).join(" "),
    company_name: companyName,
  } as Contact;
};

export const LbsProjectClientFields = ({
  variant = "default",
  seedContact,
}: {
  variant?: "default" | "create";
  /** Preloaded contact (e.g. URL preset) — skips getOne on first paint. */
  seedContact?: Contact | null;
} = {}) => {
  const isCreateVariant = variant === "create";
  const { setValue } = useFormContext<Deal & Record<string, unknown>>();
  const contactId = useWatch({ name: "contact_id" });
  const selectedContactId = isValidRecordId(contactId)
    ? Number(contactId)
    : null;

  const [optimisticContact, setOptimisticContact] = useState<Contact | null>(
    null,
  );
  const skipGetOneForId = useRef<number | null>(null);

  const shouldFetchSelectedContact =
    selectedContactId != null && skipGetOneForId.current !== selectedContactId;

  const { data: selectedContact, isError: selectedContactError } =
    useGetOne<Contact>(
      "contacts",
      { id: selectedContactId as number },
      { enabled: shouldFetchSelectedContact, retry: false },
    );

  useEffect(() => {
    if (!seedContact || !isValidRecordId(seedContact.id)) return;
    const id = Number(seedContact.id);
    skipGetOneForId.current = id;
    setOptimisticContact(
      toAutocompleteContact(id, seedContact.company_name ?? "", seedContact),
    );
  }, [seedContact]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDefaults, setDialogDefaults] = useState<ContactCreateDefaults>(
    {},
  );
  const pendingCreateRef = useRef<PendingClientCreate | null>(null);

  const clearClient = useCallback(() => {
    setOptimisticContact(null);
    skipGetOneForId.current = null;
    setValue("contact_id", null, { shouldDirty: true });
    setValue("contact_ids", [], { shouldDirty: true });
    setValue("company_id", null, { shouldDirty: true });
    setValue("company_name", "", { shouldDirty: true });
  }, [setValue]);

  useEffect(() => {
    if (!selectedContactError) return;
    clearClient();
  }, [clearClient, selectedContactError]);

  useEffect(() => {
    if (
      selectedContact &&
      optimisticContact &&
      String(selectedContact.id) === String(optimisticContact.id)
    ) {
      setOptimisticContact(null);
      skipGetOneForId.current = null;
    }
  }, [optimisticContact, selectedContact]);

  const activeContact =
    optimisticContact &&
    selectedContactId != null &&
    String(optimisticContact.id) === String(selectedContactId)
      ? optimisticContact
      : selectedContact;

  const applyClientToProject = (
    contactIdValue: Identifier,
    companyId: Identifier | null | undefined,
    businessName: string,
  ) => {
    setValue("contact_id", Number(contactIdValue), { shouldDirty: true });
    setValue("contact_ids", [Number(contactIdValue)], { shouldDirty: true });
    if (isValidRecordId(companyId)) {
      setValue("company_id", Number(companyId), { shouldDirty: true });
      setValue("company_name", businessName, { shouldDirty: false });
    } else {
      setValue("company_id", null, { shouldDirty: true });
      setValue("company_name", businessName.trim(), { shouldDirty: true });
    }
  };

  const settlePendingCreate = (record?: Contact) => {
    pendingCreateRef.current?.resolve(record);
    pendingCreateRef.current = null;
  };

  const closeClientCreate = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      queueMicrotask(() => {
        if (pendingCreateRef.current) {
          settlePendingCreate(undefined);
        }
      });
    }
  };

  const startContactCreateFromSearch = (defaults?: ContactCreateDefaults) => {
    setDialogDefaults(defaults ?? {});
    setDialogOpen(true);
    return new Promise<Contact | undefined>((resolve) => {
      pendingCreateRef.current = { resolve };
    });
  };

  const finishContactSelection = (
    contactIdValue: Identifier,
    companyId: Identifier | null | undefined,
    businessName: string,
    contact?: Partial<Contact> | null,
  ) => {
    const record = toAutocompleteContact(contactIdValue, businessName, contact);
    skipGetOneForId.current = Number(contactIdValue);
    setOptimisticContact(record);
    applyClientToProject(contactIdValue, companyId, businessName);
    settlePendingCreate(record);
    setDialogOpen(false);
  };

  const handleContactCreated = (contact: Contact) => {
    finishContactSelection(
      contact.id,
      contact.company_id ?? null,
      contact.company_name ?? "",
      contact,
    );
  };

  const contactSummaryDetails = activeContact
    ? [
        ...(getContactEmail(activeContact) !== "—"
          ? [
              {
                key: "email",
                icon: Mail,
                text: getContactEmail(activeContact),
              },
            ]
          : []),
        ...(getContactPhone(activeContact) !== "—"
          ? [
              {
                key: "phone",
                icon: Phone,
                text: getContactPhone(activeContact),
              },
            ]
          : []),
      ]
    : [];

  return (
    <>
      {isCreateVariant ? (
        <CreateFormSectionLabel required>Contact</CreateFormSectionLabel>
      ) : null}

      {isCreateVariant && selectedContactId != null ? (
        <SelectedEntityRow
          title={
            activeContact
              ? getContactFullName(activeContact)
              : lbsProjectContactName(activeContact)
          }
          subtitle={activeContact?.company_name?.trim() || undefined}
          details={contactSummaryDetails}
          profileHref={
            activeContact ? getPersonShowPath(activeContact) : undefined
          }
          onRemove={clearClient}
          removeAriaLabel="Clear contact"
        />
      ) : (
        <ReferenceInput source="contact_id" reference="contacts">
          <AutocompleteInput
            label={isCreateVariant ? false : "Contact"}
            inputText={lbsProjectContactName}
            validate={required()}
            helperText={false}
            placeholder="Search contact"
            filterToQuery={(searchText) => ({ q: searchText })}
            onCreate={(searchText) => {
              const query = searchText?.trim() ?? "";
              return startContactCreateFromSearch({ contactName: query });
            }}
            createItemLabel='Create contact "%{item}"'
            labelVariant={isCreateVariant ? undefined : "floating"}
          />
        </ReferenceInput>
      )}

      {!isCreateVariant ? (
        <ReferenceInput source="company_id" reference="companies">
          <AutocompleteCompanyInput
            label="Account"
            placeholder="Search company"
            labelVariant="floating"
          />
        </ReferenceInput>
      ) : null}

      <ContactFormDialog
        open={dialogOpen}
        onOpenChange={closeClientCreate}
        navigateOnCreate={false}
        title="New contact"
        submitLabel="Create contact"
        createDefaults={buildContactCreateDefaults(dialogDefaults.contactName)}
        onCreated={handleContactCreated}
      />
    </>
  );
};
