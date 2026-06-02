import type { ReactNode } from "react";
import { Globe, Mail, MapPin, Phone } from "lucide-react";
import type { Company, Contact, EmailAndType } from "@/components/atomic-crm/types";
import { getBusinessEmailFromLinks } from "@/lbs/clients/clientContextLinks";
import type { CompanyWithPrimaryContact } from "@/lbs/clients/clientProfile";
import {
  getContactEmail,
  getContactPhone,
} from "@/lbs/clients/clientShowUtils";
import { mailtoHref } from "@/lib/linking";

const pickFirstEmail = (emails?: EmailAndType[] | null) =>
  emails?.find((entry) => String(entry.email ?? "").trim())?.email?.trim() ??
  "";

const formatCompanyAddress = (company: Company) => {
  const line1 = company.address?.trim();
  const line2 = [company.city, company.state_abbr, company.zipcode]
    .filter((part) => part?.trim())
    .join(", ")
    .trim();
  return [line1, line2].filter(Boolean).join(" · ") || null;
};

const websiteHref = (website?: string | null) => {
  const trimmed = website?.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
};

const resolveLinkedEmail = (
  company: Company,
  contact?: Contact | null,
): string | null => {
  if (contact) {
    const fromContact = getContactEmail(contact);
    if (fromContact && fromContact !== "—") return fromContact;
  }

  const companyRecord = company as CompanyWithPrimaryContact;
  const fromPrimary = pickFirstEmail(companyRecord.primary_contact_email_jsonb);
  if (fromPrimary) return fromPrimary;

  const fromBusiness = getBusinessEmailFromLinks(company.context_links)?.trim();
  return fromBusiness || null;
};

const MetaItem = ({
  icon,
  children,
  href,
}: {
  icon: ReactNode;
  children: string;
  href?: string;
}) => (
  <span className="inline-flex max-w-full items-center gap-1.5">
    <span className="shrink-0 text-muted-foreground/70">{icon}</span>
    {href ? (
      <a
        href={href}
        target={href.startsWith("mailto:") ? undefined : "_blank"}
        rel={href.startsWith("mailto:") ? undefined : "noopener noreferrer"}
        className="truncate text-foreground/80 hover:text-primary hover:underline"
      >
        {children}
      </a>
    ) : (
      <span className="truncate">{children}</span>
    )}
  </span>
);

export const ProposalCrmLinkedMeta = ({
  company,
  contact,
}: {
  company?: Company | null;
  contact?: Contact | null;
}) => {
  if (!company) return null;

  const address = formatCompanyAddress(company);
  const companyPhone = company.phone_number?.trim();
  const site = company.website?.trim();
  const siteUrl = websiteHref(site);
  const email = resolveLinkedEmail(company, contact);
  const emailHref = email ? mailtoHref(email) : null;

  const contactPhone =
    contact && getContactPhone(contact) !== "—" ? getContactPhone(contact) : null;

  if (!address && !companyPhone && !site && !email && !contactPhone) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border/60 pt-2 text-xs text-muted-foreground">
      {address ? (
        <MetaItem icon={<MapPin className="size-3.5" />}>{address}</MetaItem>
      ) : null}
      {email && emailHref ? (
        <MetaItem icon={<Mail className="size-3.5" />} href={emailHref}>
          {email}
        </MetaItem>
      ) : null}
      {companyPhone ? (
        <MetaItem icon={<Phone className="size-3.5" />}>{companyPhone}</MetaItem>
      ) : null}
      {site && siteUrl ? (
        <MetaItem icon={<Globe className="size-3.5" />} href={siteUrl}>
          {site}
        </MetaItem>
      ) : null}
      {contactPhone && contactPhone !== companyPhone ? (
        <MetaItem icon={<Phone className="size-3.5" />}>
          {contactPhone}
        </MetaItem>
      ) : null}
    </div>
  );
};
