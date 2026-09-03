import type { ReactNode } from "react";
import type { Company, Contact } from "@/components/atomic-crm/types";
import { CompanyAvatar } from "@/components/atomic-crm/companies/CompanyAvatar";
import { Avatar as ContactAvatar } from "@/components/atomic-crm/contacts/Avatar";
import {
  getContactEmail,
  getContactFullName,
  getContactPhone,
} from "@/modules/clients/clientShowUtils";
import {
  resolveCompanyEmailForDisplay,
  resolveCompanyPhoneForDisplay,
} from "@/modules/clients/companyChannelResolvers";
import { companySectorLabel } from "@/modules/contacts/companyDraft";

const isDisplayValue = (value: string) =>
  Boolean(value?.trim()) && value.trim() !== "—";

export const RICH_REFERENCE_RESOURCES = new Set(["contacts", "companies"]);

export const isRichReferenceResource = (resource?: string) =>
  resource != null && RICH_REFERENCE_RESOURCES.has(resource);

const ReferenceOptionSingleLine = ({
  title,
  meta,
}: {
  title: string;
  meta?: string;
}) => (
  <p className="min-w-0 flex-1 truncate text-left text-sm leading-snug">
    <span className="font-medium">{title}</span>
    {meta ? <span className="text-muted-foreground"> · {meta}</span> : null}
  </p>
);

const ReferenceOptionWithAvatar = ({
  avatar,
  title,
  meta,
}: {
  avatar: ReactNode;
  title: string;
  meta?: string;
}) => (
  <div className="flex min-w-0 items-center gap-3 text-left">
    <span className="shrink-0">{avatar}</span>
    <ReferenceOptionSingleLine title={title} meta={meta} />
  </div>
);

export const contactReferenceShortLabel = (contact?: Partial<Contact> | null) =>
  getContactFullName(contact as Contact);

export const companyReferenceShortLabel = (company?: Partial<Company> | null) =>
  company?.name?.trim() || "";

export const buildContactSearchMeta = (contact: Contact) => {
  const parts: string[] = [];
  if (contact.company_name?.trim()) {
    parts.push(contact.company_name.trim());
  }
  if (contact.title?.trim()) {
    parts.push(contact.title.trim());
  }
  const email = getContactEmail(contact);
  if (isDisplayValue(email)) parts.push(email);
  const phone = getContactPhone(contact);
  if (isDisplayValue(phone)) parts.push(phone);
  return parts.join(" · ");
};

export const buildCompanySearchMeta = (company: Company) => {
  const parts: string[] = [];
  const sector = companySectorLabel(company.sector);
  if (sector) parts.push(sector);
  const email = resolveCompanyEmailForDisplay(company);
  if (isDisplayValue(email)) parts.push(email);
  const phone = resolveCompanyPhoneForDisplay(company);
  if (isDisplayValue(phone)) parts.push(phone);
  return parts.join(" · ");
};

export const renderContactReferenceOption = (contact: Contact): ReactNode => {
  const title = contactReferenceShortLabel(contact);
  const meta = buildContactSearchMeta(contact);
  return (
    <ReferenceOptionWithAvatar
      avatar={<ContactAvatar record={contact} width={25} />}
      title={title}
      meta={meta || undefined}
    />
  );
};

export const renderCompanyReferenceOption = (company: Company): ReactNode => {
  const title = companyReferenceShortLabel(company) || "—";
  const meta = buildCompanySearchMeta(company);
  return (
    <ReferenceOptionWithAvatar
      avatar={<CompanyAvatar record={company} width={25} />}
      title={title}
      meta={meta || undefined}
    />
  );
};

export const renderReferenceOptionContent = (
  resource: string | undefined,
  record: unknown,
): ReactNode | null => {
  if (!record || typeof record !== "object") return null;
  if (resource === "contacts") {
    return renderContactReferenceOption(record as Contact);
  }
  if (resource === "companies") {
    return renderCompanyReferenceOption(record as Company);
  }
  return null;
};

export const getReferenceOptionShortLabel = (
  resource: string | undefined,
  record: unknown,
): string | null => {
  if (!record || typeof record !== "object") return null;
  if (resource === "contacts") {
    const label = contactReferenceShortLabel(record as Contact);
    return label !== "—" ? label : null;
  }
  if (resource === "companies") {
    const label = companyReferenceShortLabel(record as Company);
    return label || null;
  }
  return null;
};

/** Shared width class for searchable entity pickers. */
export const entitySearchPopoverClassName =
  "w-[max(var(--radix-popover-trigger-width),min(28rem,calc(100vw-2rem)))] overflow-hidden p-0";
