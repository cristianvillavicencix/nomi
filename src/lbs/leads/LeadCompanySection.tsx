import { useEffect } from "react";
import { useGetOne } from "ra-core";
import { useFormContext, useWatch } from "react-hook-form";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { PhoneInput } from "@/components/admin/phone-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import type { Company } from "@/components/atomic-crm/types";
import {
  LBS_COMPANY_INDUSTRY_CHOICES,
} from "./leadFormConstants";
import type { NewLeadFormValues } from "./newLeadFormTypes";

const AddContactChoice = ({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
}) => (
  <div className="space-y-2 rounded-md border border-dashed bg-muted/30 p-3">
    <p className="text-sm font-medium">
      ¿Agregar contacto principal de esta empresa?
    </p>
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={cn(
          "flex-1 rounded-md border px-3 py-2 text-sm",
          value
            ? "border-primary bg-primary/5 font-medium"
            : "border-border hover:bg-muted/50",
        )}
      >
        Sí
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={cn(
          "flex-1 rounded-md border px-3 py-2 text-sm",
          !value
            ? "border-primary bg-primary/5 font-medium"
            : "border-border hover:bg-muted/50",
        )}
      >
        No
      </button>
    </div>
  </div>
);

export const LeadCompanySection = () => {
  const isMobile = useIsMobile();
  const { setValue } = useFormContext<NewLeadFormValues>();
  const companyId = useWatch<NewLeadFormValues, "company_id">({ name: "company_id" });
  const companyIsNew = useWatch<NewLeadFormValues, "company_is_new">({
    name: "company_is_new",
  });
  const addPrimaryContact = useWatch<NewLeadFormValues, "add_primary_contact">({
    name: "add_primary_contact",
  });
  const draftName = useWatch<NewLeadFormValues, "company_draft_name">({
    name: "company_draft_name",
  });

  const { data: selectedCompany } = useGetOne<Company>(
    "companies",
    { id: companyId! },
    { enabled: Boolean(companyId) && !companyIsNew },
  );

  const showDraftFields = companyIsNew || (!companyId && Boolean(draftName?.trim()));

  useEffect(() => {
    if (companyId && !companyIsNew) {
      setValue("company_draft_name", "", { shouldDirty: false });
    }
  }, [companyId, companyIsNew, setValue]);

  const beginNewCompany = (prefillName?: string) => {
    setValue("company_id", null, { shouldDirty: true });
    setValue("company_is_new", true, { shouldDirty: true });
    if (prefillName?.trim()) {
      setValue("company_draft_name", prefillName.trim(), { shouldDirty: true });
    }
  };

  return (
    <div className="space-y-3">
      <ReferenceInput
        source="company_id"
        reference="companies"
        perPage={25}
        sort={{ field: "name", order: "ASC" }}
      >
        <AutocompleteInput
          label="Company name"
          optionText="name"
          helperText={false}
          modal={isMobile}
          onChange={(value) => {
            if (value != null && value !== "") {
              setValue("company_is_new", false, { shouldDirty: true });
            }
          }}
          onCreate={async (name?: string) => {
            beginNewCompany(name);
            return undefined;
          }}
          createItemLabel='Create "%{item}"'
          createLabel="Search existing or type a new company"
        />
      </ReferenceInput>

      {showDraftFields ? (
        <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground">
            New company — complete the essentials below.
          </p>
          {companyIsNew ? (
            <TextInput
              source="company_draft_name"
              label="Business name"
              helperText={false}
            />
          ) : null}
          <TextInput
            source="company_draft_website"
            label="Website"
            helperText={false}
            placeholder="www.example.com"
          />
          <PhoneInput
            source="company_draft_phone"
            label="Company phone"
            helperText={false}
          />
          <TextInput
            source="company_draft_address"
            label="Address"
            helperText={false}
            multiline
          />
          <SelectInput
            source="company_draft_sector"
            label="Industry"
            choices={[...LBS_COMPANY_INDUSTRY_CHOICES]}
            optionText="name"
            helperText={false}
            emptyText="Select industry"
          />
        </div>
      ) : selectedCompany ? (
        <p className="text-xs text-muted-foreground">
          Using existing company: <strong>{selectedCompany.name}</strong>
          {selectedCompany.website ? ` · ${selectedCompany.website}` : ""}
        </p>
      ) : null}

      <AddContactChoice
        value={addPrimaryContact}
        onChange={(next) =>
          setValue("add_primary_contact", next, { shouldDirty: true })
        }
      />
    </div>
  );
};
