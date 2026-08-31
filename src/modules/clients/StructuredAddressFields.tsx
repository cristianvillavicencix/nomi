import { useWatch } from "react-hook-form";
import { TextInput } from "@/components/admin/text-input";
import type { ClientCreateFormValues } from "@/modules/clients/ClientCreateForm";
import { shouldShowCountryField } from "@/modules/clients/clientAddressUtils";

type AddressFieldPrefix = "company" | "billing";

const field = (prefix: AddressFieldPrefix, part: string) =>
  `${prefix}_${part}` as keyof ClientCreateFormValues;

type StructuredAddressFieldsProps = {
  prefix: AddressFieldPrefix;
  forceShowCountry?: boolean;
  showStreet?: boolean;
};

export const StructuredAddressFields = ({
  prefix,
  forceShowCountry = false,
  showStreet = true,
}: StructuredAddressFieldsProps) => {
  const country = useWatch<ClientCreateFormValues>({
    name: field(prefix, "country"),
  });
  const showCountry = forceShowCountry || shouldShowCountryField(country);

  return (
    <div className="space-y-3">
      {showStreet ? (
        <TextInput
          source={field(prefix, "address")}
          label="Street"
          helperText={false}
          labelVariant="floating"
        />
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <TextInput
          source={field(prefix, "city")}
          label="City"
          helperText={false}
          labelVariant="floating"
        />
        <TextInput
          source={field(prefix, "state_abbr")}
          label="State"
          helperText={false}
          labelVariant="floating"
        />
        <TextInput
          source={field(prefix, "zipcode")}
          label="ZIP"
          helperText={false}
          labelVariant="floating"
        />
      </div>
      {showCountry ? (
        <TextInput
          source={field(prefix, "country")}
          label="Country"
          helperText={false}
          labelVariant="floating"
        />
      ) : null}
    </div>
  );
};

export const BUSINESS_ADDRESS_FIELD_NAMES = [
  "company_address",
  "company_city",
  "company_state_abbr",
  "company_zipcode",
  "company_country",
] as const satisfies readonly (keyof ClientCreateFormValues)[];

export const BILLING_ADDRESS_FIELD_NAMES = [
  "billing_address",
  "billing_city",
  "billing_state_abbr",
  "billing_zipcode",
  "billing_country",
] as const satisfies readonly (keyof ClientCreateFormValues)[];
