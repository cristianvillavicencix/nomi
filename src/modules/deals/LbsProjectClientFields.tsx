import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { required, useGetList, useGetOne, type Identifier } from "ra-core";
import { useFormContext, useWatch } from "react-hook-form";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { AutocompleteCompanyInput } from "@/components/atomic-crm/companies/AutocompleteCompanyInput";
import type { Company, Contact, Deal } from "@/components/atomic-crm/types";
import { getContactFullName } from "@/modules/clients/clientShowUtils";
import { ContactFormDialog } from "@/modules/contacts/ContactFormDialog";
import { lbsProjectContactName } from "@/modules/deals/LbsProjectContactOption";
import { CONTACT_STATUS_FILTER } from "@/modules/shared/relatedFilters";
import { resolvePrimaryContactId } from "@/modules/work/workCreateAccountLinkUtils";
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

/**
 * Account first, then contact. Picking an account auto-selects its only
 * contact (or primary); multiple contacts stay choosable. Supports create.
 */
export const LbsProjectClientFields = ({
  seedContact,
}: {
  /** Prefill from URL/contact page — company + contact come from form defaults. */
  seedContact?: Contact | null;
} = {}) => {
  const { setValue } = useFormContext<Deal & Record<string, unknown>>();
  const companyId = useWatch({ name: "company_id" }) as
    | Identifier
    | null
    | undefined;
  const contactId = useWatch({ name: "contact_id" }) as
    | Identifier
    | null
    | undefined;

  const selectedCompanyId = isValidRecordId(companyId)
    ? Number(companyId)
    : null;

  const { data: company } = useGetOne<Company>(
    "companies",
    { id: selectedCompanyId as number },
    { enabled: selectedCompanyId != null },
  );

  const { data: companyContacts = [], isFetched: companyContactsFetched } =
    useGetList<Contact>(
      "contacts",
      {
        filter: {
          "company_id@eq": selectedCompanyId,
          "status@in": CONTACT_STATUS_FILTER,
        },
        pagination: { page: 1, perPage: 100 },
        sort: { field: "last_name", order: "ASC" },
      },
      { enabled: selectedCompanyId != null, staleTime: 30_000 },
    );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDefaults, setDialogDefaults] = useState<ContactCreateDefaults>(
    {},
  );
  const pendingCreateRef = useRef<PendingClientCreate | null>(null);
  const seededRef = useRef(false);

  useEffect(() => {
    if (seededRef.current || !seedContact || !isValidRecordId(seedContact.id)) {
      return;
    }
    seededRef.current = true;
    if (isValidRecordId(seedContact.company_id)) {
      setValue("company_id", Number(seedContact.company_id), {
        shouldDirty: false,
      });
      setValue("company_name", seedContact.company_name ?? "", {
        shouldDirty: false,
      });
    }
    setValue("contact_id", Number(seedContact.id), { shouldDirty: false });
    setValue("contact_ids", [Number(seedContact.id)], { shouldDirty: false });
  }, [seedContact, setValue]);

  useEffect(() => {
    if (selectedCompanyId == null) {
      if (contactId != null) {
        setValue("contact_id", null, { shouldDirty: true });
      }
      return;
    }

    if (company?.name) {
      setValue("company_name", company.name, { shouldDirty: false });
    }

    // Wait until contacts load so we don't wipe a valid selection mid-fetch.
    if (!companyContactsFetched) return;

    const nextContactId = resolvePrimaryContactId(
      selectedCompanyId,
      contactId,
      companyContacts,
      company?.primary_contact_id,
    );

    if (String(nextContactId ?? "") !== String(contactId ?? "")) {
      setValue("contact_id", nextContactId, { shouldDirty: true });
    }
  }, [
    selectedCompanyId,
    company?.name,
    company?.primary_contact_id,
    companyContacts,
    companyContactsFetched,
    contactId,
    setValue,
  ]);

  const settlePendingCreate = useCallback((record?: Contact) => {
    pendingCreateRef.current?.resolve(record);
    pendingCreateRef.current = null;
  }, []);

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

  const handleContactCreated = (contact: Contact) => {
    if (isValidRecordId(contact.company_id)) {
      setValue("company_id", Number(contact.company_id), { shouldDirty: true });
      setValue("company_name", contact.company_name ?? "", {
        shouldDirty: false,
      });
    }
    setValue("contact_id", Number(contact.id), { shouldDirty: true });
    setValue("contact_ids", [Number(contact.id)], { shouldDirty: true });
    settlePendingCreate(contact);
    setDialogOpen(false);
  };

  const contactEmptyText = useMemo(() => {
    if (selectedCompanyId == null) return "Select an account first";
    if (companyContacts.length === 0) return "No contacts — create one";
    return "Select contact";
  }, [selectedCompanyId, companyContacts.length]);

  return (
    <>
      <ReferenceInput source="company_id" reference="companies">
        <AutocompleteCompanyInput
          label="Account"
          placeholder="Search account"
          labelVariant="floating"
          validate={required()}
        />
      </ReferenceInput>

      <ReferenceInput
        source="contact_id"
        reference="contacts"
        filter={
          selectedCompanyId != null
            ? {
                "company_id@eq": selectedCompanyId,
                "status@in": CONTACT_STATUS_FILTER,
              }
            : { "id@eq": -1 }
        }
      >
        <AutocompleteInput
          label="Contact"
          optionText={lbsProjectContactName}
          inputText={getContactFullName}
          validate={required()}
          helperText={false}
          disabled={selectedCompanyId == null}
          placeholder={contactEmptyText}
          emptyText={contactEmptyText}
          filterToQuery={(searchText) => ({ q: searchText })}
          onCreate={(searchText) => {
            const query = searchText?.trim() ?? "";
            return startContactCreateFromSearch({ contactName: query });
          }}
          createLabel="Create new contact"
          labelVariant="floating"
        />
      </ReferenceInput>

      <ContactFormDialog
        open={dialogOpen}
        onOpenChange={closeClientCreate}
        navigateOnCreate={false}
        title="New contact"
        submitLabel="Create contact"
        description={
          company?.name
            ? `Contact for ${company.name}`
            : "Contact for the selected account"
        }
        lockCompanyId={selectedCompanyId ?? undefined}
        createDefaults={{
          ...buildContactCreateDefaults(dialogDefaults.contactName),
          status: "contact_only",
          person_kind: "contact_only",
          lead_stage: null,
          ...(selectedCompanyId != null
            ? { company_id: selectedCompanyId }
            : {}),
        }}
        onCreated={handleContactCreated}
      />
    </>
  );
};
