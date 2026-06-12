const readString = (...values: unknown[]) => {
  for (const value of values) {
    const normalized = String(value ?? "").trim();
    if (normalized) return normalized;
  }
  return undefined;
};

export const buildWebsiteIntakePayload = ({
  formId,
  data,
}: {
  formId: string | number;
  data: Record<string, unknown>;
}) => ({
  formId,
  data,
  companyName: readString(data.business_name, data.company_name),
  contactEmail: readString(data.email, data.contact_email),
  businessEmail: readString(data.business_email, data.company_email),
  contactFirstName: readString(data.first_name, data.contact_first_name),
  contactLastName: readString(data.last_name, data.contact_last_name),
  contactPhone: readString(data.phone, data.contact_phone, data.phone_number),
  website: readString(data.website, data.company_website),
  address: readString(data.address, data.street),
  city: readString(data.city),
  state: readString(data.state, data.state_abbr),
  zipcode: readString(data.zipcode, data.postal_code),
  country: readString(data.country),
});
