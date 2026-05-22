import { useRef, useState } from "react";
import { required, type Identifier } from "ra-core";
import { useFormContext } from "react-hook-form";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import type { Deal } from "@/components/atomic-crm/types";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  lbsProjectContactName,
  lbsProjectContactOptionText,
} from "@/lbs/deals/LbsProjectContactOption";
import {
  QuickCreateClientDialog,
  toQuickCreateContactRecord,
  type QuickCreateClientDefaults,
  type QuickCreateContactRecord,
} from "@/lbs/clients/QuickCreateClientDialog";
import type { QuickCreateClientInput } from "@/lbs/clients/lbsClientUpsert";

type PendingQuickCreate = {
  resolve: (record: QuickCreateContactRecord) => void;
  reject: (error: Error) => void;
};

export const LbsProjectClientFields = () => {
  const isMobile = useIsMobile();
  const { setValue } = useFormContext<Deal & Record<string, unknown>>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDefaults, setDialogDefaults] = useState<QuickCreateClientDefaults>({});
  const pendingCreateRef = useRef<PendingQuickCreate | null>(null);

  const applyClientToProject = (
    contactId: Identifier,
    companyId: Identifier,
    businessName: string,
  ) => {
    setValue("contact_id", Number(contactId), { shouldDirty: true });
    setValue("contact_ids", [Number(contactId)], { shouldDirty: true });
    setValue("company_id", Number(companyId), { shouldDirty: true });
    setValue("company_name", businessName, { shouldDirty: false });
  };

  const closeQuickCreate = () => {
    setDialogOpen(false);
    if (pendingCreateRef.current) {
      pendingCreateRef.current.reject(new Error("cancelled"));
      pendingCreateRef.current = null;
    }
  };

  const startQuickCreateFromSearch = (defaults?: QuickCreateClientDefaults) => {
    setDialogDefaults(defaults ?? {});
    setDialogOpen(true);
    return new Promise<QuickCreateContactRecord>((resolve, reject) => {
      pendingCreateRef.current = { resolve, reject };
    });
  };

  const handleCreated = (
    result: { company_id: Identifier; contact_id: Identifier },
    values: QuickCreateClientInput,
  ) => {
    applyClientToProject(result.contact_id, result.company_id, values.businessName.trim());
    const record = toQuickCreateContactRecord(result, values);
    pendingCreateRef.current?.resolve(record);
    pendingCreateRef.current = null;
    setDialogOpen(false);
  };

  return (
    <>
      <ReferenceInput source="contact_id" reference="contacts_summary">
        <AutocompleteInput
          label="Client contact"
          optionText={lbsProjectContactOptionText}
          inputText={lbsProjectContactName}
          validate={required()}
          helperText={false}
          placeholder="Search contact"
          filterToQuery={(searchText) => ({ q: searchText })}
          onCreate={(searchText) => {
            const query = searchText?.trim() ?? "";
            return startQuickCreateFromSearch({ contactName: query });
          }}
          createItemLabel='Create a new client "%{item}"'
          modal={isMobile}
        />
      </ReferenceInput>

      <ReferenceInput source="company_id" reference="companies">
        <AutocompleteInput
          label="Company"
          optionText="name"
          helperText={false}
          placeholder="Search company"
          filterToQuery={(searchText) => ({ q: searchText })}
        />
      </ReferenceInput>

      <QuickCreateClientDialog
        open={dialogOpen}
        defaults={dialogDefaults}
        onClose={closeQuickCreate}
        onCreated={handleCreated}
      />
    </>
  );
};
