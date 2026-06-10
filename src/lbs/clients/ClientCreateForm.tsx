import { useEffect, useMemo } from "react";
import type { Identifier } from "ra-core";
import { useFormContext, useWatch } from "react-hook-form";
import { GooglePlacesAutocompleteInput } from "@/components/admin/google-places-autocomplete-input";
import { isGooglePlacesEnabled } from "@/lib/googlePlaces";
import {
  applyGoogleAddressToClientForm,
  applyGoogleBusinessToClientForm,
} from "@/lbs/clients/applyGooglePlaceToClientForm";
import { BooleanInput } from "@/components/admin/boolean-input";
import { EmailInput } from "@/components/admin/email-input";
import { PhoneInput } from "@/components/admin/phone-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";
import { Separator } from "@/components/ui/separator";
import { ChevronDown } from "lucide-react";
import { LBS_COMPANY_INDUSTRY_CHOICES } from "@/lbs/leads/leadFormConstants";
import { PrimaryContactReferenceCard } from "@/lbs/clients/PrimaryContactReferenceCard";
import { getContactFullName } from "@/lbs/clients/clientShowUtils";
import { ClientSocialLinksInput } from "@/lbs/clients/ClientSocialLinksInput";
import type { ClientSocialLinkValue } from "@/lbs/clients/clientSocialLinks";
import {
  COMPANY_CHANNEL_TYPE_CHOICES,
  type ClientChannelFormValue,
} from "@/lbs/clients/clientChannels";
import { ProgressiveMultiChannelInput } from "@/lbs/shared/ProgressiveMultiChannelInput";
import {
  BILLING_ADDRESS_FIELD_NAMES,
  BUSINESS_ADDRESS_FIELD_NAMES,
  StructuredAddressFields,
} from "@/lbs/clients/StructuredAddressFields";
import type { Contact } from "@/components/atomic-crm/types";

export type ClientCreateFormValues = {
  primary_full_name: string;
  primary_email: string;
  primary_phone: string;
  selected_primary_contact_id: Identifier | null;
  company_name: string;
  company_emails: ClientChannelFormValue[];
  company_phones: ClientChannelFormValue[];
  company_website: string;
  company_sector: string;
  social_links: ClientSocialLinkValue[];
  company_address: string;
  company_city: string;
  company_state_abbr: string;
  company_zipcode: string;
  company_country: string;
  billing_same_as_business: boolean;
  billing_address: string;
  billing_city: string;
  billing_state_abbr: string;
  billing_zipcode: string;
  billing_country: string;
  invoice_same_as_primary: boolean;
  invoice_contact_name: string;
  invoice_email: string;
  invoice_phone: string;
  notes: string;
};

export type ClientCreateFormFieldsProps = {
  mode: "create" | "edit";
  companyId?: Identifier;
  primaryContact?: Contact | null;
};

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

export const ClientCreateFormFields = ({
  mode,
  companyId,
  primaryContact,
}: ClientCreateFormFieldsProps) => {
  const { setValue } = useFormContext<ClientCreateFormValues>();
  const placesEnabled = isGooglePlacesEnabled();
  const industryChoices = LBS_COMPANY_INDUSTRY_CHOICES.map((entry) => ({
    value: entry.id,
    label: entry.name,
  }));
  const selectedPrimaryId = useWatch<
    ClientCreateFormValues,
    "selected_primary_contact_id"
  >({ name: "selected_primary_contact_id" });
  const primaryNameDraft = useWatch<
    ClientCreateFormValues,
    "primary_full_name"
  >({ name: "primary_full_name" });
  const primaryEmailDraft = useWatch<ClientCreateFormValues, "primary_email">({
    name: "primary_email",
  });
  const primaryPhoneDraft = useWatch<ClientCreateFormValues, "primary_phone">({
    name: "primary_phone",
  });

  const primaryContactSummary = useMemo(() => {
    if (mode === "edit") {
      if (
        primaryContact &&
        selectedPrimaryId != null &&
        String(primaryContact.id) === String(selectedPrimaryId)
      ) {
        return getContactFullName(primaryContact);
      }
      return selectedPrimaryId != null ? "Contact selected" : null;
    }
    return (
      primaryNameDraft?.trim() ||
      primaryEmailDraft?.trim() ||
      primaryPhoneDraft?.trim() ||
      null
    );
  }, [
    mode,
    primaryContact,
    primaryEmailDraft,
    primaryNameDraft,
    primaryPhoneDraft,
    selectedPrimaryId,
  ]);

  return (
    <div className="flex flex-col gap-6 p-1">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Business</h2>
        {placesEnabled ? (
          <GooglePlacesAutocompleteInput
            source="company_name"
            label="Business name"
            mode="business"
            validate={requiredName}
            helperText={false}
            onPlaceDetails={(details) =>
              applyGoogleBusinessToClientForm(setValue, details)
            }
          />
        ) : (
          <TextInput
            source="company_name"
            label="Business name"
            validate={requiredName}
            helperText={false}
          />
        )}
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
        <TextInput
          source="company_website"
          label="Website"
          helperText={false}
          validate={optionalUrl}
        />
        <SelectInput
          source="company_sector"
          label="Industry"
          choices={industryChoices}
          optionText="label"
          optionValue="value"
          helperText={false}
          emptyText="Select industry"
        />
        {placesEnabled ? (
          <GooglePlacesAutocompleteInput
            source="company_address"
            label="Street"
            mode="address"
            helperText={false}
            onPlaceDetails={(details) =>
              applyGoogleAddressToClientForm(setValue, details, "company")
            }
          />
        ) : null}
        <StructuredAddressFields prefix="company" forceShowCountry={placesEnabled} showStreet={!placesEnabled} />
      </section>

      <details className="group rounded-md border">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
            <span>
              Primary contact
              <span className="ml-1.5 font-normal text-muted-foreground">
                (optional)
              </span>
            </span>
            {primaryContactSummary ? (
              <span className="truncate font-normal text-muted-foreground">
                — {primaryContactSummary}
              </span>
            ) : null}
          </span>
          <ChevronDown className="size-4 shrink-0 opacity-60 transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-4 border-t px-4 pt-4 pb-4">
          {mode === "create" ? (
            <>
              <p className="text-sm text-muted-foreground">
                Creates a contact linked to this company. Leave collapsed if you
                do not need one yet.
              </p>
              <TextInput
                source="primary_full_name"
                label="Full name"
                helperText={false}
              />
              <EmailInput
                source="primary_email"
                label="Email"
                helperText={false}
              />
              <PhoneInput
                source="primary_phone"
                label="Phone"
                helperText={false}
              />
            </>
          ) : companyId != null ? (
            <PrimaryContactReferenceCard
              companyId={companyId}
              selectedContactId={selectedPrimaryId}
              primaryContact={primaryContact}
              onSelectContact={(id) =>
                setValue("selected_primary_contact_id", id, {
                  shouldDirty: true,
                })
              }
            />
          ) : null}
        </div>
      </details>

      <Separator />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Billing</h2>
        <BooleanInput
          source="billing_same_as_business"
          label="Use same business address for billing"
        />
        <BillingAddressFields />
        <BooleanInput
          source="invoice_same_as_primary"
          label="Use same primary contact for invoices"
        />
        <InvoiceContactFields primaryContact={primaryContact} />
      </section>

      <Separator />

      <details className="group rounded-md border">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
          Social media &amp; notes
          <ChevronDown className="size-4 opacity-60 transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-4 border-t px-4 pt-4 pb-4">
          <ClientSocialLinksInput source="social_links" />
          <TextInput source="notes" label="Notes" helperText={false} multiline />
        </div>
      </details>
    </div>
  );
};

const BillingAddressFields = () => {
  const billingSameAsBusiness = useWatch<
    ClientCreateFormValues,
    "billing_same_as_business"
  >({
    name: "billing_same_as_business",
  });
  const { setValue } = useFormContext<ClientCreateFormValues>();

  const businessValues = useWatch<ClientCreateFormValues>({
    name: BUSINESS_ADDRESS_FIELD_NAMES,
  });

  useEffect(() => {
    if (!billingSameAsBusiness) return;
    BUSINESS_ADDRESS_FIELD_NAMES.forEach((source, index) => {
      const billingField = BILLING_ADDRESS_FIELD_NAMES[index];
      setValue(billingField, businessValues?.[index] ?? "", {
        shouldDirty: true,
      });
    });
  }, [billingSameAsBusiness, businessValues, setValue]);

  if (billingSameAsBusiness) return null;

  return <StructuredAddressFields prefix="billing" />;
};

const InvoiceContactFields = ({
  primaryContact,
}: {
  primaryContact?: Contact | null;
}) => {
  const invoiceSameAsPrimary = useWatch<
    ClientCreateFormValues,
    "invoice_same_as_primary"
  >({
    name: "invoice_same_as_primary",
  });
  const { setValue } = useFormContext<ClientCreateFormValues>();
  const primaryName = useWatch<ClientCreateFormValues, "primary_full_name">({
    name: "primary_full_name",
  });
  const primaryEmail = useWatch<ClientCreateFormValues, "primary_email">({
    name: "primary_email",
  });
  const primaryPhone = useWatch<ClientCreateFormValues, "primary_phone">({
    name: "primary_phone",
  });

  useEffect(() => {
    if (!invoiceSameAsPrimary) return;
    const contactName = primaryContact
      ? `${primaryContact.first_name ?? ""} ${primaryContact.last_name ?? ""}`.trim()
      : primaryName;
    const contactEmail =
      primaryContact?.email_jsonb?.find((e) => e.email?.trim())?.email ??
      primaryEmail;
    const contactPhone =
      primaryContact?.phone_jsonb?.find((p) => p.number?.trim())?.number ??
      primaryPhone;
    setValue("invoice_contact_name", contactName ?? "", { shouldDirty: true });
    setValue("invoice_email", contactEmail ?? "", { shouldDirty: true });
    setValue("invoice_phone", contactPhone ?? "", { shouldDirty: true });
  }, [
    invoiceSameAsPrimary,
    primaryContact,
    primaryName,
    primaryEmail,
    primaryPhone,
    setValue,
  ]);

  if (invoiceSameAsPrimary) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <TextInput
        source="invoice_contact_name"
        label="Invoice contact name"
        helperText={false}
      />
      <EmailInput source="invoice_email" label="Invoice email" helperText={false} />
      <PhoneInput source="invoice_phone" label="Invoice phone" helperText={false} />
    </div>
  );
};

export { splitClientFullName } from "@/lbs/clients/clientFormUtils";

/** @deprecated Use company_address directly. */
export const formatCompanyAddressForPrimary = (
  values: Pick<ClientCreateFormValues, "company_address">,
) => values.company_address?.trim() ?? "";

export const singleChannel = (value?: string) =>
  value?.trim()
    ? [{ value: value.trim(), type: "Work" as const, isPrimary: true }]
    : [];
