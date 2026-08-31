import { required, useGetIdentity, useGetOne, type Identifier } from "ra-core";
import { useFormContext, useWatch } from "react-hook-form";
import { GooglePlacesAutocompleteInput } from "@/components/admin/google-places-autocomplete-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { isGooglePlacesEnabled } from "@/lib/googlePlaces";
import {
  applyGoogleAddressToClientForm,
  applyGoogleBusinessToClientForm,
} from "@/modules/clients/applyGooglePlaceToClientForm";
import type { ClientCreateFormValues } from "@/modules/clients/ClientCreateForm";
import { clearStreamlinedCompanyDependentFields } from "@/modules/clients/clientFormValues";
import { COMPANY_CHANNEL_TYPE_CHOICES } from "@/modules/clients/clientChannels";
import { ProgressiveMultiChannelInput } from "@/modules/shared/ProgressiveMultiChannelInput";
import { PrimaryContactReferenceCard } from "@/modules/clients/PrimaryContactReferenceCard";
import {
  getPrimaryContactDraftFromFormValues,
  type PrimaryContactDraft,
} from "@/modules/clients/primaryContactDraft";
import { StructuredAddressFields } from "@/modules/clients/StructuredAddressFields";
import { LBS_COMPANY_INDUSTRY_CHOICES } from "@/modules/leads/leadFormConstants";
import {
  CreateFormCollapsible,
  CreateFormFieldRow,
  CreateFormSection,
} from "@/modules/shared/createForm/CreateFormLayout";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import type {
  Contact,
  OrganizationMember,
} from "@/components/atomic-crm/types";

const requiredName = (value?: string) =>
  value?.trim() ? undefined : "Required";

const optionalUrl = (url?: string) => {
  if (!url?.trim()) return;
  const urlRegex =
    /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([-.]{1}[a-z0-9]+)*\.[a-z]{2,}(:[0-9]{1,5})?(\/.*)?$/i;
  if (!urlRegex.test(url.trim())) {
    return "Must be a valid URL";
  }
};

const memberDisplayName = (member?: Partial<OrganizationMember>) => {
  if (!member) return "";
  const name = [member.first_name, member.last_name].filter(Boolean).join(" ");
  return member.email ? `${name} (${member.email})` : name;
};

const COMPANY_SIZE_CHOICES = [
  { id: 1, name: "1" },
  { id: 10, name: "2–10" },
  { id: 50, name: "11–50" },
  { id: 250, name: "51–250" },
  { id: 500, name: "250+" },
];

/** Streamlined company create layout with floating labels and sections. */
export const ClientCreateStreamlinedFields = ({
  duplicateNotice,
}: {
  duplicateNotice?: ReactNode;
} = {}) => {
  const { identity } = useGetIdentity();
  const { setValue, getValues } = useFormContext<ClientCreateFormValues>();
  const placesEnabled = isGooglePlacesEnabled();
  const industryChoices = LBS_COMPANY_INDUSTRY_CHOICES.map((entry) => ({
    value: entry.id,
    label: entry.name,
  }));

  const selectedPrimaryId = useWatch<
    ClientCreateFormValues,
    "selected_primary_contact_id"
  >({ name: "selected_primary_contact_id" });
  const primaryFullName = useWatch<ClientCreateFormValues, "primary_full_name">(
    {
      name: "primary_full_name",
    },
  );
  const primaryEmail = useWatch<ClientCreateFormValues, "primary_email">({
    name: "primary_email",
  });
  const primaryPhone = useWatch<ClientCreateFormValues, "primary_phone">({
    name: "primary_phone",
  });
  const companyName = useWatch<ClientCreateFormValues, "company_name">({
    name: "company_name",
  });
  const prevCompanyNameRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const current = companyName?.trim() ?? "";
    const previous = prevCompanyNameRef.current?.trim() ?? "";
    prevCompanyNameRef.current = companyName;

    if (previous.length > 0 && current.length === 0) {
      clearStreamlinedCompanyDependentFields(
        setValue,
        getValues("organization_member_id"),
      );
    }
  }, [companyName, getValues, setValue]);

  const draftPrimaryContact = useMemo(
    () =>
      getPrimaryContactDraftFromFormValues({
        selected_primary_contact_id: selectedPrimaryId,
        primary_full_name: primaryFullName ?? "",
        primary_email: primaryEmail ?? "",
        primary_phone: primaryPhone ?? "",
      }),
    [primaryEmail, primaryFullName, primaryPhone, selectedPrimaryId],
  );

  const { data: selectedPrimaryContact } = useGetOne<Contact>(
    "contacts",
    { id: selectedPrimaryId! },
    { enabled: selectedPrimaryId != null },
  );

  const applyExistingPrimary = (id: Identifier) => {
    setValue("selected_primary_contact_id", id, { shouldDirty: true });
    setValue("primary_full_name", "", { shouldDirty: true });
    setValue("primary_email", "", { shouldDirty: true });
    setValue("primary_phone", "", { shouldDirty: true });
  };

  const applyDraftPrimary = (draft: PrimaryContactDraft) => {
    setValue("selected_primary_contact_id", null, { shouldDirty: true });
    setValue("primary_full_name", draft.fullName, { shouldDirty: true });
    setValue("primary_email", draft.email, { shouldDirty: true });
    setValue("primary_phone", draft.phone, { shouldDirty: true });
  };

  const clearPrimarySelection = () => {
    setValue("selected_primary_contact_id", null, { shouldDirty: true });
    setValue("primary_full_name", "", { shouldDirty: true });
    setValue("primary_email", "", { shouldDirty: true });
    setValue("primary_phone", "", { shouldDirty: true });
  };

  return (
    <div className="space-y-6">
      <CreateFormSection
        title="Account"
        description="Business identity and how customers reach you."
      >
        {placesEnabled ? (
          <GooglePlacesAutocompleteInput
            source="company_name"
            label="Company name"
            mode="business"
            validate={requiredName}
            helperText={false}
            labelVariant="floating"
            onPlaceDetails={(details) =>
              applyGoogleBusinessToClientForm(setValue, details)
            }
          />
        ) : (
          <TextInput
            source="company_name"
            label="Company name"
            validate={requiredName}
            helperText={false}
            labelVariant="floating"
          />
        )}

        {duplicateNotice}

        <TextInput
          source="company_website"
          label="Website"
          helperText={false}
          validate={optionalUrl}
          labelVariant="floating"
        />

        <ProgressiveMultiChannelInput<ClientCreateFormValues>
          source="company_emails"
          kind="email"
          label="Email"
          valueKey="value"
          typeChoices={COMPANY_CHANNEL_TYPE_CHOICES}
          addLabel="+ Add email"
        />
        <ProgressiveMultiChannelInput<ClientCreateFormValues>
          source="company_phones"
          kind="phone"
          label="Phone"
          valueKey="value"
          typeChoices={COMPANY_CHANNEL_TYPE_CHOICES}
          addLabel="+ Add phone"
        />
      </CreateFormSection>

      <CreateFormSection
        title="Address"
        description="Where this business is located."
      >
        {placesEnabled ? (
          <GooglePlacesAutocompleteInput
            source="company_address"
            label="Address"
            mode="address"
            helperText={false}
            labelVariant="floating"
            onPlaceDetails={(details) =>
              applyGoogleAddressToClientForm(setValue, details, "company")
            }
          />
        ) : null}
        <StructuredAddressFields
          prefix="company"
          forceShowCountry={placesEnabled}
          showStreet={!placesEnabled}
        />
      </CreateFormSection>

      <CreateFormSection
        title="Primary contact"
        description="Who we reach first for this account."
      >
        <PrimaryContactReferenceCard
          mode="create"
          selectedContactId={selectedPrimaryId}
          draftPrimaryContact={draftPrimaryContact}
          onSelectContact={applyExistingPrimary}
          onSelectDraftContact={applyDraftPrimary}
          onClearContact={clearPrimarySelection}
        />
      </CreateFormSection>

      <CreateFormSection title="Details">
        <CreateFormFieldRow columns={2}>
          <SelectInput
            source="company_sector"
            label="Sector"
            choices={industryChoices}
            optionText="label"
            optionValue="value"
            helperText={false}
            emptyText=" "
            labelVariant="floating"
          />
          <ReferenceInput
            source="organization_member_id"
            reference="organization_members"
            filter={{ "disabled@neq": true }}
          >
            <AutocompleteInput
              label="Assigned to"
              optionText={memberDisplayName}
              helperText={false}
              defaultValue={identity?.id}
              validate={required()}
              labelVariant="floating"
            />
          </ReferenceInput>
        </CreateFormFieldRow>
      </CreateFormSection>

      <CreateFormCollapsible label="More optional fields">
        <CreateFormFieldRow columns={2}>
          <SelectInput
            source="company_size"
            label="Size (employees)"
            choices={COMPANY_SIZE_CHOICES}
            optionText="name"
            helperText={false}
            emptyText=" "
            labelVariant="floating"
          />
          <TextInput
            source="company_revenue"
            label="Revenue"
            helperText={false}
            labelVariant="floating"
          />
        </CreateFormFieldRow>
        <CreateFormFieldRow columns={2}>
          <TextInput
            source="tax_identifier"
            label="Tax identifier"
            helperText={false}
            labelVariant="floating"
          />
          <TextInput
            source="linkedin_url"
            label="LinkedIn URL"
            helperText={false}
            validate={optionalUrl}
            labelVariant="floating"
          />
        </CreateFormFieldRow>
        <TextInput
          source="notes"
          label="Description"
          helperText={false}
          multiline
          labelVariant="floating"
        />
      </CreateFormCollapsible>
    </div>
  );
};
