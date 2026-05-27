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
import { LBS_COMPANY_INDUSTRY_CHOICES } from "./leadFormConstants";
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

const CompanyModeToggle = ({
  isNew,
  onSelectNew,
  onSelectExisting,
}: {
  isNew: boolean;
  onSelectNew: () => void;
  onSelectExisting: () => void;
}) => (
  <div className="grid grid-cols-2 gap-2">
    <button
      type="button"
      onClick={onSelectNew}
      className={cn(
        "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
        isNew
          ? "border-primary bg-primary/5 font-medium"
          : "border-border hover:bg-muted/50",
      )}
    >
      Nueva empresa
    </button>
    <button
      type="button"
      onClick={onSelectExisting}
      className={cn(
        "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
        !isNew
          ? "border-primary bg-primary/5 font-medium"
          : "border-border hover:bg-muted/50",
      )}
    >
      Ya en el CRM
    </button>
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

  const { data: selectedCompany } = useGetOne<Company>(
    "companies",
    { id: companyId! },
    { enabled: Boolean(companyId) && !companyIsNew },
  );

  const selectNewCompany = () => {
    setValue("company_is_new", true, { shouldDirty: true });
    setValue("company_id", null, { shouldDirty: true });
  };

  const selectExistingCompany = () => {
    setValue("company_is_new", false, { shouldDirty: true });
    setValue("company_draft_name", "", { shouldDirty: true });
    setValue("company_draft_website", "", { shouldDirty: true });
    setValue("company_draft_phone", "", { shouldDirty: true });
    setValue("company_draft_address", "", { shouldDirty: true });
    setValue("company_draft_sector", "", { shouldDirty: true });
    setValue("use_company_contact_info", false, { shouldDirty: true });
  };

  useEffect(() => {
    if (companyIsNew) return;
    if (companyId) {
      setValue("company_draft_name", "", { shouldDirty: false });
    }
  }, [companyId, companyIsNew, setValue]);

  return (
    <div className="space-y-3">
      <CompanyModeToggle
        isNew={companyIsNew}
        onSelectNew={selectNewCompany}
        onSelectExisting={selectExistingCompany}
      />

      {companyIsNew ? (
        <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground">
            Datos de la empresa que quieres registrar con este lead.
          </p>
          <TextInput
            source="company_draft_name"
            label="Nombre de la empresa"
            helperText={false}
            placeholder="Ej. Acme Landscaping"
          />
          <TextInput
            source="company_draft_website"
            label="Sitio web"
            helperText={false}
            placeholder="www.ejemplo.com"
          />
          <PhoneInput
            source="company_draft_phone"
            label="Teléfono de la empresa"
            helperText={false}
          />
          <TextInput
            source="company_draft_address"
            label="Dirección"
            helperText={false}
            multiline
          />
          <SelectInput
            source="company_draft_sector"
            label="Industria"
            choices={[...LBS_COMPANY_INDUSTRY_CHOICES]}
            optionText="name"
            helperText={false}
            emptyText="Selecciona industria"
          />
        </div>
      ) : (
        <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground">
            Solo si esta empresa ya está registrada en el CRM.
          </p>
          <ReferenceInput
            source="company_id"
            reference="companies"
            perPage={25}
            sort={{ field: "name", order: "ASC" }}
          >
            <AutocompleteInput
              label="Buscar empresa"
              optionText="name"
              helperText={false}
              modal={isMobile}
              placeholder="Escribe el nombre…"
              createLabel={false}
            />
          </ReferenceInput>
          {selectedCompany ? (
            <p className="text-xs text-muted-foreground">
              Seleccionada: <strong>{selectedCompany.name}</strong>
              {selectedCompany.website ? ` · ${selectedCompany.website}` : ""}
            </p>
          ) : null}
        </div>
      )}

      <AddContactChoice
        value={addPrimaryContact}
        onChange={(next) =>
          setValue("add_primary_contact", next, { shouldDirty: true })
        }
      />
    </div>
  );
};
