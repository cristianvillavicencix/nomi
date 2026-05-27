import { useEffect } from "react";
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
import {
  interestedServiceChoices,
  leadSourceChoices,
} from "@/lbs/constants/leadSource";
import { Separator } from "@/components/ui/separator";
import { ClientChannelsInput } from "@/lbs/clients/ClientChannelsInput";
import { getPrimaryChannelValue } from "@/lbs/clients/clientChannels";
import type { ClientChannelFormValue } from "@/lbs/clients/clientChannels";
import { ClientSocialLinksInput } from "@/lbs/clients/ClientSocialLinksInput";
import type { ClientSocialLinkValue } from "@/lbs/clients/clientSocialLinks";

export type ClientCreateFormValues = {
  primary_full_name: string;
  primary_emails: ClientChannelFormValue[];
  primary_phones: ClientChannelFormValue[];
  primary_address: string;
  company_name: string;
  company_emails: ClientChannelFormValue[];
  company_phones: ClientChannelFormValue[];
  company_website: string;
  social_links: ClientSocialLinkValue[];
  company_same_as_primary_address: boolean;
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
  primary_lead_source: string;
  interested_service: string;
  notes: string;
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

export const ClientCreateFormFields = () => {
  const { setValue } = useFormContext<ClientCreateFormValues>();
  const placesEnabled = isGooglePlacesEnabled();

  return (
    <div className="flex flex-col gap-6 p-1">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Business information</h2>
        <p className="text-sm text-muted-foreground">
          The client account is tied to this business.
        </p>
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
        <ClientChannelsInput
          source="company_emails"
          kind="email"
          label="Business email"
        />
        <ClientChannelsInput
          source="company_phones"
          kind="phone"
          label="Business phone"
        />
        <TextInput
          source="company_website"
          label="Website"
          helperText={false}
          validate={optionalUrl}
        />
        <BooleanInput
          source="company_same_as_primary_address"
          label="Use same address as primary contact"
        />
        <CompanyAddressFields />
      </section>

      <Separator />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Primary contact</h2>
        <p className="text-sm text-muted-foreground">
          Main person for this client. You can change this later in Contacts.
        </p>
        <TextInput
          source="primary_full_name"
          label="Full name"
          validate={requiredName}
          helperText={false}
        />
        <ClientChannelsInput
          source="primary_emails"
          kind="email"
          label="Email"
        />
        <ClientChannelsInput
          source="primary_phones"
          kind="phone"
          label="Phone"
        />
        {placesEnabled ? (
          <GooglePlacesAutocompleteInput
            source="primary_address"
            label="Address"
            mode="address"
            multiline
            helperText={false}
            onPlaceDetails={(details) =>
              applyGoogleAddressToClientForm(setValue, details, "primary")
            }
          />
        ) : (
          <TextInput
            source="primary_address"
            label="Address"
            helperText={false}
            multiline
          />
        )}
        <SelectInput
          source="primary_lead_source"
          label="How did they hear about us?"
          choices={leadSourceChoices}
          optionText="label"
          optionValue="value"
          helperText={false}
          create
        />
        <SelectInput
          source="interested_service"
          label="Service interested in"
          choices={interestedServiceChoices}
          optionText="label"
          optionValue="value"
          helperText={false}
          create
        />
      </section>

      <Separator />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Billing information</h2>
        <BooleanInput
          source="billing_same_as_business"
          label="Use same business address for billing"
        />
        <BillingAddressFields />
        <BooleanInput
          source="invoice_same_as_primary"
          label="Use same primary contact for invoices"
        />
        <InvoiceContactFields />
      </section>

      <Separator />

      <section className="space-y-4">
        <ClientSocialLinksInput source="social_links" label="Social profile" />
        <TextInput source="notes" label="Notes" helperText={false} multiline />
      </section>
    </div>
  );
};

const AddressFields = ({
  prefix,
  readOnly,
}: {
  prefix: "company" | "billing";
  readOnly: boolean;
}) => {
  const { setValue } = useFormContext<ClientCreateFormValues>();
  const placesEnabled = isGooglePlacesEnabled();
  const addressSource =
    prefix === "company" ? "company_address" : "billing_address";

  return (
  <div className="grid gap-4">
    {placesEnabled && !readOnly ? (
      <GooglePlacesAutocompleteInput
        source={addressSource}
        label="Address"
        mode="address"
        multiline
        helperText={false}
        onPlaceDetails={(details) =>
          applyGoogleAddressToClientForm(setValue, details, prefix)
        }
      />
    ) : (
      <TextInput
        source={addressSource}
        label="Address"
        helperText={false}
        multiline
        readOnly={readOnly}
      />
    )}
    <div className="grid gap-4 md:grid-cols-2">
      <TextInput
        source={`${prefix}_city`}
        label="City"
        helperText={false}
        readOnly={readOnly}
      />
      <TextInput
        source={`${prefix}_state_abbr`}
        label="State"
        helperText={false}
        readOnly={readOnly}
      />
      <TextInput
        source={`${prefix}_zipcode`}
        label="Zip code"
        helperText={false}
        readOnly={readOnly}
      />
      <TextInput
        source={`${prefix}_country`}
        label="Country"
        helperText={false}
        readOnly={readOnly}
      />
    </div>
  </div>
  );
};

const CompanyAddressFields = () => {
  const companySameAsPrimary = useWatch<
    ClientCreateFormValues,
    "company_same_as_primary_address"
  >({
    name: "company_same_as_primary_address",
  });
  const { setValue } = useFormContext<ClientCreateFormValues>();
  const primaryAddress = useWatch<ClientCreateFormValues, "primary_address">({
    name: "primary_address",
  });

  useEffect(() => {
    if (!companySameAsPrimary) return;
    setValue("company_address", primaryAddress ?? "", { shouldDirty: true });
    setValue("company_city", "", { shouldDirty: true });
    setValue("company_state_abbr", "", { shouldDirty: true });
    setValue("company_zipcode", "", { shouldDirty: true });
    setValue("company_country", "", { shouldDirty: true });
  }, [companySameAsPrimary, primaryAddress, setValue]);

  if (companySameAsPrimary) {
    return null;
  }

  return <AddressFields prefix="company" readOnly={false} />;
};

const BillingAddressFields = () => {
  const billingSameAsBusiness = useWatch<
    ClientCreateFormValues,
    "billing_same_as_business"
  >({
    name: "billing_same_as_business",
  });
  const { setValue } = useFormContext<ClientCreateFormValues>();
  const companyAddress = useWatch<ClientCreateFormValues, "company_address">({
    name: "company_address",
  });
  const companyCity = useWatch<ClientCreateFormValues, "company_city">({
    name: "company_city",
  });
  const companyState = useWatch<ClientCreateFormValues, "company_state_abbr">({
    name: "company_state_abbr",
  });
  const companyZip = useWatch<ClientCreateFormValues, "company_zipcode">({
    name: "company_zipcode",
  });
  const companyCountry = useWatch<ClientCreateFormValues, "company_country">({
    name: "company_country",
  });
  const companySameAsPrimary = useWatch<
    ClientCreateFormValues,
    "company_same_as_primary_address"
  >({
    name: "company_same_as_primary_address",
  });
  const primaryAddress = useWatch<ClientCreateFormValues, "primary_address">({
    name: "primary_address",
  });

  useEffect(() => {
    if (!billingSameAsBusiness) return;
    if (companySameAsPrimary) {
      setValue("billing_address", primaryAddress ?? "", { shouldDirty: true });
      setValue("billing_city", "", { shouldDirty: true });
      setValue("billing_state_abbr", "", { shouldDirty: true });
      setValue("billing_zipcode", "", { shouldDirty: true });
      setValue("billing_country", "", { shouldDirty: true });
      return;
    }
    setValue("billing_address", companyAddress ?? "", { shouldDirty: true });
    setValue("billing_city", companyCity ?? "", { shouldDirty: true });
    setValue("billing_state_abbr", companyState ?? "", { shouldDirty: true });
    setValue("billing_zipcode", companyZip ?? "", { shouldDirty: true });
    setValue("billing_country", companyCountry ?? "", { shouldDirty: true });
  }, [
    billingSameAsBusiness,
    companySameAsPrimary,
    primaryAddress,
    companyAddress,
    companyCity,
    companyState,
    companyZip,
    companyCountry,
    setValue,
  ]);

  if (billingSameAsBusiness) {
    return null;
  }

  return <AddressFields prefix="billing" readOnly={false} />;
};

const InvoiceContactFields = () => {
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
  const primaryEmails = useWatch<ClientCreateFormValues, "primary_emails">({
    name: "primary_emails",
  });
  const primaryPhones = useWatch<ClientCreateFormValues, "primary_phones">({
    name: "primary_phones",
  });

  useEffect(() => {
    if (!invoiceSameAsPrimary) return;
    setValue("invoice_contact_name", primaryName ?? "", { shouldDirty: true });
    setValue("invoice_email", getPrimaryChannelValue(primaryEmails), {
      shouldDirty: true,
    });
    setValue("invoice_phone", getPrimaryChannelValue(primaryPhones), {
      shouldDirty: true,
    });
  }, [
    invoiceSameAsPrimary,
    primaryName,
    primaryEmails,
    primaryPhones,
    setValue,
  ]);

  if (invoiceSameAsPrimary) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <TextInput
        source="invoice_contact_name"
        label="Invoice contact name"
        helperText={false}
      />
      <EmailInput
        source="invoice_email"
        label="Invoice email"
        helperText={false}
      />
      <PhoneInput
        source="invoice_phone"
        label="Invoice phone"
        helperText={false}
      />
    </div>
  );
};

export const splitClientFullName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: "", lastName: "" };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
};
