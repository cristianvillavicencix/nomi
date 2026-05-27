import { useFormContext, useWatch } from "react-hook-form";
import { GooglePlacesAutocompleteInput } from "@/components/admin/google-places-autocomplete-input";
import { PhoneInput } from "@/components/admin/phone-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";
import { cn } from "@/lib/utils";
import { LBS_COMPANY_INDUSTRY_CHOICES } from "./leadFormConstants";
import {
  applyGoogleAddressToLeadForm,
  applyGoogleBusinessToLeadForm,
} from "./applyGoogleBusinessToLeadForm";
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
  const { setValue } = useFormContext<NewLeadFormValues>();
  const addPrimaryContact = useWatch<NewLeadFormValues, "add_primary_contact">({
    name: "add_primary_contact",
  });

  return (
    <div className="space-y-3">
      <GooglePlacesAutocompleteInput
        source="company_draft_name"
        label="Nombre de la empresa"
        mode="business"
        helperText={false}
        placeholder="Ej. Acme Landscaping"
        onPlaceDetails={(details) =>
          applyGoogleBusinessToLeadForm(setValue, details)
        }
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
      <GooglePlacesAutocompleteInput
        source="company_draft_address"
        label="Dirección"
        mode="address"
        helperText={false}
        onPlaceDetails={(details) =>
          applyGoogleAddressToLeadForm(setValue, details)
        }
      />
      <SelectInput
        source="company_draft_sector"
        label="Industria"
        choices={[...LBS_COMPANY_INDUSTRY_CHOICES]}
        optionText="name"
        helperText={false}
        emptyText="Selecciona industria"
      />

      <AddContactChoice
        value={addPrimaryContact}
        onChange={(next) =>
          setValue("add_primary_contact", next, { shouldDirty: true })
        }
      />
    </div>
  );
};
