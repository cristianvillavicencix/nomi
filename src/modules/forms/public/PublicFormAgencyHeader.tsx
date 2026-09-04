import {
  PRODUCT_ORG,
  PRODUCT_ORG_ADDRESS,
  PRODUCT_ORG_EMAIL,
  PRODUCT_ORG_PHONE,
  PRODUCT_ORG_WEBSITE,
} from "@/lib/branding";

export const formatAgencyPhoneDisplay = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
};

export const resolvePublicFormAgency = (form: {
  agency_name?: string | null;
  agency_phone?: string | null;
  agency_email?: string | null;
  agency_address?: string | null;
  agency_website?: string | null;
  logo_url?: string | null;
}) => ({
  agencyName: String(form.agency_name ?? "").trim() || PRODUCT_ORG,
  agencyPhone: String(form.agency_phone ?? "").trim() || PRODUCT_ORG_PHONE,
  agencyEmail: String(form.agency_email ?? "").trim() || PRODUCT_ORG_EMAIL,
  agencyAddress: String(form.agency_address ?? "").trim() || PRODUCT_ORG_ADDRESS,
  agencyWebsite: String(form.agency_website ?? "").trim() || PRODUCT_ORG_WEBSITE,
  logoUrl: String(form.logo_url ?? "").trim() || "/logos/sigma.png",
});

export const PublicFormAgencyHeader = ({
  company,
  phone,
  email,
  address,
  website,
  compact = false,
}: {
  company: string;
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
  compact?: boolean;
}) => {
  const phoneDisplay = phone ? formatAgencyPhoneDisplay(phone) : "";
  const contactLine = [email, phoneDisplay, website].filter(Boolean).join(" | ");

  return (
    <div className={compact ? "space-y-0.5" : "space-y-1 text-center"}>
      <p
        className={
          compact
            ? "text-sm font-semibold tracking-tight"
            : "text-lg font-semibold tracking-tight"
        }
      >
        {company}
      </p>
      {contactLine ? (
        <p
          className={
            compact
              ? "text-xs text-muted-foreground"
              : "text-sm text-muted-foreground"
          }
        >
          {contactLine}
        </p>
      ) : null}
      {address ? (
        <p
          className={
            compact
              ? "text-xs text-muted-foreground"
              : "text-sm text-muted-foreground"
          }
        >
          {address}
        </p>
      ) : null}
    </div>
  );
};
