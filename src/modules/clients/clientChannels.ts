import type {
  EmailAndType,
  PhoneNumberAndType,
} from "@/components/atomic-crm/types";
import type { ClientSocialLinkValue } from "@/modules/clients/clientSocialLinks";
import { normalizeSocialUrl } from "@/modules/clients/clientSocialLinks";

export type ClientChannelType = EmailAndType["type"] | "Billing";

export type ClientChannelFormValue = {
  value: string;
  type: ClientChannelType;
  isPrimary: boolean;
};

export const CHANNEL_TYPE_CHOICES = [
  { id: "Work", name: "Work" },
  { id: "Home", name: "Home" },
  { id: "Other", name: "Other" },
] as const;

export const COMPANY_CHANNEL_TYPE_CHOICES = [
  { id: "Work", name: "Work" },
  { id: "Billing", name: "Billing" },
  { id: "Other", name: "Other" },
] as const;

export const CONTACT_CHANNEL_TYPE_CHOICES = CHANNEL_TYPE_CHOICES;

const emptyChannelRow = (): ClientChannelFormValue => ({
  value: "",
  type: "Work",
  isPrimary: true,
});

export const getPrimaryChannelValue = (
  channels?: ClientChannelFormValue[] | null,
) => {
  const list = cleanChannelFormValues(channels);
  return list.find((entry) => entry.isPrimary)?.value ?? list[0]?.value ?? "";
};

export const cleanChannelFormValues = (
  channels?: ClientChannelFormValue[] | null,
) => {
  const cleaned = (channels ?? [])
    .map((entry) => ({
      value: entry.value?.trim() ?? "",
      type: entry.type ?? "Work",
      isPrimary: Boolean(entry.isPrimary),
    }))
    .filter((entry) => entry.value);

  if (cleaned.length === 0) return [];

  const primaryIndex = cleaned.findIndex((entry) => entry.isPrimary);
  const ordered =
    primaryIndex > 0
      ? [
          cleaned[primaryIndex],
          ...cleaned.slice(0, primaryIndex),
          ...cleaned.slice(primaryIndex + 1),
        ]
      : primaryIndex === -1
        ? cleaned.map((entry, index) => ({ ...entry, isPrimary: index === 0 }))
        : cleaned;

  return ordered.map((entry, index) => ({
    ...entry,
    isPrimary: index === 0,
  }));
};

export const emailsToFormValues = (
  emails?: EmailAndType[] | null,
  legacyPrimary?: string | null,
): ClientChannelFormValue[] => {
  const fromJson = (emails ?? [])
    .filter((entry) => entry.email?.trim())
    .map((entry, index) => ({
      value: entry.email.trim(),
      type: (entry.type ?? "Work") as ClientChannelType,
      isPrimary: index === 0,
    }));

  if (fromJson.length > 0) return fromJson;

  const legacy = legacyPrimary?.trim();
  return legacy
    ? [{ value: legacy, type: "Work", isPrimary: true }]
    : [emptyChannelRow()];
};

export const phonesToFormValues = (
  phones?: PhoneNumberAndType[] | null,
  legacyPrimary?: string | null,
): ClientChannelFormValue[] => {
  const fromJson = (phones ?? [])
    .filter((entry) => entry.number?.trim())
    .map((entry, index) => ({
      value: entry.number.trim(),
      type: (entry.type ?? "Work") as ClientChannelType,
      isPrimary: index === 0,
    }));

  if (fromJson.length > 0) return fromJson;

  const legacy = legacyPrimary?.trim();
  return legacy
    ? [{ value: legacy, type: "Work", isPrimary: true }]
    : [emptyChannelRow()];
};

/** Load all company email rows from context_links (primary + extras). */
export const companyEmailsToFormValues = (
  companyEmails?: EmailAndType[] | null,
  businessEmail?: string | null,
): ClientChannelFormValue[] => {
  const rows = (companyEmails ?? [])
    .filter((entry) => entry.email?.trim())
    .map((entry, index) => ({
      value: entry.email.trim(),
      type: (entry.type ?? "Work") as ClientChannelType,
      isPrimary: index === 0,
    }));

  const primary = businessEmail?.trim();
  if (rows.length === 0) {
    return primary
      ? [{ value: primary, type: "Work", isPrimary: true }]
      : [emptyChannelRow()];
  }

  if (
    primary &&
    rows[0].value !== primary &&
    !rows.some((row) => row.value === primary)
  ) {
    return [
      { value: primary, type: "Work", isPrimary: true },
      ...rows.map((row) => ({ ...row, isPrimary: false })),
    ];
  }

  return rows;
};

/** Load all company phone rows from context_links and phone_number. */
export const companyPhonesToFormValues = (
  companyPhones?: PhoneNumberAndType[] | null,
  legacyPrimary?: string | null,
): ClientChannelFormValue[] => phonesToFormValues(companyPhones, legacyPrimary);

export const formValuesToEmailJsonb = (
  channels?: ClientChannelFormValue[] | null,
): EmailAndType[] =>
  cleanChannelFormValues(channels).map((entry) => ({
    email: entry.value,
    type: entry.type as EmailAndType["type"],
  }));

export const formValuesToPhoneJsonb = (
  channels?: ClientChannelFormValue[] | null,
): PhoneNumberAndType[] =>
  cleanChannelFormValues(channels).map((entry) => ({
    number: entry.value,
    type: entry.type as PhoneNumberAndType["type"],
  }));

export const mergeClientSocialLinksForForm = (
  companyLinks: ClientSocialLinkValue[],
  contactLinks: ClientSocialLinkValue[],
) => {
  const seen = new Set<string>();
  return [...companyLinks, ...contactLinks]
    .map((link) => ({ url: normalizeSocialUrl(link.url) }))
    .filter((link) => {
      if (!link.url) return false;
      const key = link.url.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};
