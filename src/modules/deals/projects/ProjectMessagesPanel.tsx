import { useMemo, type ReactNode } from "react";
import { Link } from "react-router";
import { useGetOne } from "ra-core";
import { Building2, ExternalLink, Mail, MapPin, User } from "lucide-react";
import type { Company, Contact } from "@/components/atomic-crm/types";
import { getClientShowPath, getPersonShowPath } from "@/app/routing";
import {
  getContactEmail,
  getContactFullName,
  getContactPhoneRaw,
} from "@/modules/clients/clientShowUtils";
import { ProjectClientSmsPanel } from "@/modules/deals/projects/ProjectClientSmsPanel";
import {
  normalizeDeploymentUrl,
  resolveProjectDeploymentUrls,
} from "@/modules/deals/projects/projectDeploymentUrls";
import { OpenMailComposeLink } from "@/modules/mail/OpenMailComposeLink";
import type { LbsDeal } from "@/modules/types";
import { CrmPhoneLink } from "@/modules/voice/CrmPhoneLink";
import { cn } from "@/lib/utils";

const InfoRow = ({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) => (
  <div className="space-y-1">
    <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {icon}
      {label}
    </p>
    <div className="min-w-0 text-sm text-foreground">{children}</div>
  </div>
);

const formatCompanyAddress = (company?: Company | null) => {
  if (!company) return null;
  const parts = [
    company.address?.trim(),
    [company.city, company.state_abbr].filter(Boolean).join(", "),
    company.zipcode?.trim(),
    company.country?.trim(),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
};

const ProjectMessagesAccountCard = ({ record }: { record: LbsDeal }) => {
  const contactId = useMemo(() => {
    if (record.contact_id != null) return Number(record.contact_id);
    if (Array.isArray(record.contact_ids) && record.contact_ids.length > 0) {
      return Number(record.contact_ids[0]);
    }
    return null;
  }, [record.contact_id, record.contact_ids]);

  const { data: contact } = useGetOne<Contact>(
    "contacts_summary",
    { id: contactId as number },
    { enabled: contactId != null },
  );
  const { data: company } = useGetOne<Company>(
    "companies",
    { id: record.company_id as number },
    { enabled: record.company_id != null },
  );

  const companyName =
    company?.name?.trim() ||
    record.company_name?.trim() ||
    (record.company_id ? `Account #${record.company_id}` : null);
  const contactName = contact ? getContactFullName(contact) : null;
  const email = contact ? getContactEmail(contact) : null;
  const phone = contact ? getContactPhoneRaw(contact) : null;
  const address = formatCompanyAddress(company);
  const website =
    company?.website?.trim() ||
    normalizeDeploymentUrl(resolveProjectDeploymentUrls(record).productionUrl) ||
    null;
  const websiteLabel = (() => {
    if (!website) return null;
    try {
      return new URL(
        website.startsWith("http") ? website : `https://${website}`,
      ).hostname.replace(/^www\./i, "");
    } catch {
      return website.replace(/^https?:\/\//i, "").replace(/\/$/, "");
    }
  })();

  return (
    <aside className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto rounded-md border bg-muted/20 p-4">
      <div className="space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Account
        </p>
        {record.company_id && companyName ? (
          <Link
            to={`${getClientShowPath(record.company_id)}?tab=deals`}
            className="block text-base font-semibold leading-snug text-foreground hover:underline"
          >
            {companyName}
          </Link>
        ) : (
          <p className="text-base font-semibold leading-snug">
            {companyName ?? "No account linked"}
          </p>
        )}
        <p className="text-xs text-muted-foreground">{record.name}</p>
      </div>

      <div className="space-y-4 border-t pt-4">
        <InfoRow icon={<User className="size-3" />} label="Contact">
          {contactId != null && contactName ? (
            <Link
              to={getPersonShowPath({
                id: contactId,
                status: contact?.status,
              })}
              className="link-action"
            >
              {contactName}
            </Link>
          ) : (
            <span className="text-muted-foreground">No contact linked</span>
          )}
        </InfoRow>

        <InfoRow icon={<Mail className="size-3" />} label="Email">
          {email && email !== "—" ? (
            <OpenMailComposeLink
              to={email}
              contactId={contactId ?? undefined}
              companyId={record.company_id ?? undefined}
              className="break-all"
            >
              {email}
            </OpenMailComposeLink>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </InfoRow>

        <InfoRow icon={<Building2 className="size-3" />} label="Phone">
          {phone ? (
            <CrmPhoneLink
              phone={phone}
              contactId={contactId}
              dealId={record.id}
              className="link-action"
            />
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </InfoRow>

        <InfoRow icon={<ExternalLink className="size-3" />} label="Website">
          {website ? (
            <a
              href={
                website.startsWith("http") ? website : `https://${website}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="link-action inline-flex items-center gap-1 break-all"
            >
              {websiteLabel}
            </a>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </InfoRow>

        <InfoRow icon={<MapPin className="size-3" />} label="Address">
          {address ? (
            <span className="leading-snug">{address}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </InfoRow>
      </div>
    </aside>
  );
};

export const ProjectMessagesPanel = ({
  record,
  className,
}: {
  record: LbsDeal;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        "grid h-full min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(15rem,18rem)_minmax(0,1fr)]",
        className,
      )}
    >
      <ProjectMessagesAccountCard record={record} />
      <div className="min-h-0 overflow-hidden rounded-md border bg-background">
        <ProjectClientSmsPanel record={record} className="h-full min-h-0" />
      </div>
    </div>
  );
};
