import { useEffect } from "react";
import { useGetOne } from "ra-core";
import { useFormContext, useWatch } from "react-hook-form";
import { TextInput } from "@/components/admin/text-input";
import { SelectInput } from "@/components/admin/select-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { Company } from "@/components/atomic-crm/types";
import { LeadChannelsInput } from "./LeadChannelsInput";
import {
  LBS_CONTACT_ROLE_CHOICES,
  LEAD_EMAIL_TYPES,
  LEAD_PHONE_TYPES,
} from "./leadFormConstants";
import type { NewLeadFormValues } from "./newLeadFormTypes";

export const LeadContactSection = () => {
  const { setValue } = useFormContext<NewLeadFormValues>();
  const leadType = useWatch<NewLeadFormValues, "lead_type">({ name: "lead_type" });
  const useCompanyInfo = useWatch<NewLeadFormValues, "use_company_contact_info">({
    name: "use_company_contact_info",
  });
  const companyId = useWatch<NewLeadFormValues, "company_id">({ name: "company_id" });
  const companyIsNew = useWatch<NewLeadFormValues, "company_is_new">({
    name: "company_is_new",
  });
  const companyDraftPhone = useWatch<NewLeadFormValues, "company_draft_phone">({
    name: "company_draft_phone",
  });

  const { data: selectedCompany } = useGetOne<Company>(
    "companies",
    { id: companyId! },
    { enabled: Boolean(companyId) && !companyIsNew },
  );

  const companyPhone = companyIsNew
    ? companyDraftPhone
    : selectedCompany?.phone_number;

  const canCopyFromCompany =
    leadType === "business" && Boolean(companyPhone?.trim());

  useEffect(() => {
    if (!useCompanyInfo || !canCopyFromCompany || !companyPhone?.trim()) return;
    setValue(
      "phone_jsonb",
      [{ number: companyPhone.trim(), type: "Work" }],
      { shouldDirty: true },
    );
  }, [useCompanyInfo, canCopyFromCompany, companyPhone, setValue]);

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
            Usar la información de contacto de la empresa (copia el teléfono de
            la empresa al contacto)
          </Label>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput
          source="first_name"
          label="First name"
          helperText={false}
        />
        <TextInput source="last_name" label="Last name" helperText={false} />
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
        label="Phone"
        typeChoices={[...LEAD_PHONE_TYPES]}
      />

      {leadType === "business" ? (
        <SelectInput
          source="title"
          label="Role / Cargo"
          choices={[...LBS_CONTACT_ROLE_CHOICES]}
          optionText="name"
          helperText={false}
          emptyText="Select role"
        />
      ) : null}
    </div>
  );
};
