import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { useGetOne } from "ra-core";
import { Status } from "@/components/atomic-crm/misc/Status";
import type { Contact } from "@/components/atomic-crm/types";
import {
  formatCompanyAddress,
  collectBusinessSocialLinks,
  getClientStatus,
  getExtraClientEmails,
  getPrimaryContactEmailFromContact,
  getPrimaryContactFullName,
  getPrimaryContactPhone,
  type CompanyWithPrimaryContact,
} from "@/lbs/clients/clientProfile";
import {
  formatBillingAddress,
  getInvoiceContactSummary,
  parseLbsClientContextLinks,
} from "@/lbs/clients/clientContextLinks";
import { ClientExtraEmailsIndicator } from "@/lbs/clients/ClientExtraEmailsIndicator";
import { ClientSocialLinksDisplay } from "@/lbs/clients/ClientSocialLinksDisplay";
import { mailtoHref } from "@/lib/linking";

const ProfileField = ({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) => (
  <div>
    <div className="text-sm text-muted-foreground">{label}</div>
    <div className="font-medium">{value}</div>
  </div>
);

type ClientOverviewTabProps = {
  record: CompanyWithPrimaryContact;
  onOpenPrimaryContact?: () => void;
};

export const ClientOverviewTab = ({
  record,
  onOpenPrimaryContact,
}: ClientOverviewTabProps) => {
  const status = getClientStatus(record);
  const invoice = getInvoiceContactSummary(record);
  const billingCtx = parseLbsClientContextLinks(record.context_links);
  const website = record.website?.trim();
  const websiteHref = website
    ? website.startsWith("http")
      ? website
      : `https://${website}`
    : null;

  const { data: primaryContact } = useGetOne<Contact>(
    "contacts",
    { id: record.primary_contact_id! },
    { enabled: !!record.primary_contact_id },
  );

  const primaryEmail = getPrimaryContactEmailFromContact(primaryContact);
  const extraEmails = getExtraClientEmails(
    record,
    primaryContact,
    primaryEmail !== "—" ? primaryEmail : undefined,
  );
  const businessSocialLinks = collectBusinessSocialLinks(record);

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h3 className="text-base font-semibold">Business information</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <ProfileField label="Business name" value={record.name || "—"} />
          <ProfileField
            label="Business phone"
            value={record.phone_number?.trim() || "—"}
          />
          <ProfileField
            label="Website"
            value={
              websiteHref ? (
                <a
                  href={websiteHref}
                  target="_blank"
                  rel="noreferrer"
                  className="link-action inline-flex items-center gap-1 font-normal"
                >
                  {website}
                  <ExternalLink className="size-3.5" />
                </a>
              ) : (
                "—"
              )
            }
          />
          <ProfileField
            label="Social profiles"
            value={
              businessSocialLinks.length > 0 ? (
                <ClientSocialLinksDisplay links={businessSocialLinks} />
              ) : (
                "—"
              )
            }
          />
          <ProfileField
            label="Business address"
            value={formatCompanyAddress(record)}
          />
          <ProfileField
            label="Notes"
            value={
              record.description?.trim() ? (
                <span className="whitespace-pre-wrap font-normal">
                  {record.description}
                </span>
              ) : (
                "—"
              )
            }
          />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-base font-semibold">Primary contact</h3>
        <p className="text-sm text-muted-foreground">
          The main person for this client. Change it from the Contacts tab.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ProfileField
            label="Client"
            value={
              onOpenPrimaryContact && record.primary_contact_id ? (
                <button
                  type="button"
                  className="link-action text-left font-medium"
                  onClick={onOpenPrimaryContact}
                >
                  {getPrimaryContactFullName(record)}
                </button>
              ) : (
                getPrimaryContactFullName(record)
              )
            }
          />
          <ProfileField label="Phone" value={getPrimaryContactPhone(record)} />
          <ProfileField
            label="Email"
            value={
              primaryEmail !== "—" ? (
                <span className="inline-flex items-center gap-1.5 font-normal">
                  <a
                    href={mailtoHref(primaryEmail)}
                    className="link-action break-all"
                  >
                    {primaryEmail}
                  </a>
                  <ClientExtraEmailsIndicator extraEmails={extraEmails} />
                </span>
              ) : extraEmails.length > 0 ? (
                <span className="inline-flex items-center gap-1.5 font-normal">
                  <a
                    href={mailtoHref(extraEmails[0].email)}
                    className="link-action break-all"
                  >
                    {extraEmails[0].email}
                  </a>
                  <ClientExtraEmailsIndicator
                    extraEmails={extraEmails.slice(1)}
                  />
                </span>
              ) : (
                "—"
              )
            }
          />
          <ProfileField
            label="Address"
            value={primaryContact?.address?.trim() || "—"}
          />
          <ProfileField
            label="Status"
            value={status === "—" ? status : <Status status={status} />}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-base font-semibold">Billing information</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <ProfileField
            label="Billing address"
            value={
              billingCtx.billingSameAsBusiness !== false
                ? `${formatBillingAddress(record)} (same as business)`
                : formatBillingAddress(record)
            }
          />
          <ProfileField
            label="Invoice contact"
            value={
              billingCtx.invoiceSameAsPrimary !== false
                ? `${invoice.name} (same as primary)`
                : invoice.name
            }
          />
          <ProfileField label="Invoice email" value={invoice.email} />
          <ProfileField label="Invoice phone" value={invoice.phone} />
        </div>
      </section>
    </div>
  );
};
