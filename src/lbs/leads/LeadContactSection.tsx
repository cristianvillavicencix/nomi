import { useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { GooglePlacesAutocompleteInput } from "@/components/admin/google-places-autocomplete-input";
import { TextInput } from "@/components/admin/text-input";
import { SelectInput } from "@/components/admin/select-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { LeadChannelsInput } from "./LeadChannelsInput";
import {
  LBS_CONTACT_ROLE_CHOICES,
  LEAD_EMAIL_TYPES,
  LEAD_PHONE_TYPES,
} from "./leadFormConstants";
import { applyGoogleAddressToContactLeadForm } from "./applyGoogleBusinessToLeadForm";
import type { NewLeadFormValues } from "./newLeadFormTypes";

export const LeadContactSection = () => {
  const { setValue } = useFormContext<NewLeadFormValues>();
  const leadType = useWatch<NewLeadFormValues, "lead_type">({ name: "lead_type" });
  const useCompanyInfo = useWatch<NewLeadFormValues, "use_company_contact_info">({
    name: "use_company_contact_info",
  });
  const companyDraftPhone = useWatch<NewLeadFormValues, "company_draft_phone">({
    name: "company_draft_phone",
  });
  const companyDraftAddress = useWatch<NewLeadFormValues, "company_draft_address">({
    name: "company_draft_address",
  });

  const canCopyFromCompany =
    leadType === "business" && Boolean(companyDraftPhone?.trim());

  useEffect(() => {
    if (!useCompanyInfo || !canCopyFromCompany || !companyDraftPhone?.trim()) {
      return;
    }
    setValue(
      "phone_jsonb",
      [{ number: companyDraftPhone.trim(), type: "Work" }],
      { shouldDirty: true },
    );
    if (companyDraftAddress?.trim()) {
      setValue("address", companyDraftAddress.trim(), { shouldDirty: true });
    }
  }, [
    useCompanyInfo,
    canCopyFromCompany,
    companyDraftPhone,
    companyDraftAddress,
    setValue,
  ]);

  return (
    <div className="space-y-3">
      {canCopyFromCompany ? (
        <div className="flex items-start gap-2 rounded-md border bg-muted/20 p-3">
          <Checkbox
            id="use-company-contact-info"
            checked={Boolean(useCompanyInfo)}
            onCheckedChange={(checked) =>
              setValue("use_company_contact_info", Boolean(checked), {
                shouldDirty: true,
              })
            }
          />
          <Label
            htmlFor="use-company-contact-info"
            className="cursor-pointer text-sm font-normal leading-snug"
          >
            Usar teléfono y dirección de la empresa en el contacto
          </Label>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput
          source="first_name"
          label="Nombre"
          helperText={false}
        />
        <TextInput source="last_name" label="Apellido" helperText={false} />
      </div>

      <LeadChannelsInput
        source="email_jsonb"
        kind="email"
        label="Email"
        typeChoices={[...LEAD_EMAIL_TYPES]}
      />
      <LeadChannelsInput
        source="phone_jsonb"
        kind="phone"
        label="Teléfono"
        typeChoices={[...LEAD_PHONE_TYPES]}
      />

      <GooglePlacesAutocompleteInput
        source="address"
        label={
          leadType === "individual"
            ? "Dirección (facturación / contacto)"
            : "Dirección del contacto"
        }
        mode="address"
        multiline
        helperText={
          leadType === "individual"
            ? "Obligatoria para facturación futura."
            : false
        }
        onPlaceDetails={(details) =>
          applyGoogleAddressToContactLeadForm(setValue, details)
        }
      />

      {leadType === "business" ? (
        <SelectInput
          source="title"
          label="Cargo"
          choices={[...LBS_CONTACT_ROLE_CHOICES]}
          optionText="name"
          helperText={false}
          emptyText="Selecciona cargo"
        />
      ) : null}
    </div>
  );
};
