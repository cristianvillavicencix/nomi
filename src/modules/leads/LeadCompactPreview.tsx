import { useMemo } from "react";
import { Link } from "react-router";
import { useGetOne, useShowContext } from "ra-core";
import { Globe, Mail, Phone } from "lucide-react";
import { Avatar } from "@/components/atomic-crm/contacts/Avatar";
import type { Company, Contact } from "@/components/atomic-crm/types";
import { Skeleton } from "@/components/ui/skeleton";
import { getClientShowPath } from "@/app/routing";
import {
  getContactEmail,
  getContactFullName,
  getContactPhoneRaw,
} from "@/modules/clients/clientShowUtils";
import { resolveCompanyAddressForDisplay } from "@/modules/clients/clientAddressUtils";
import {
  collectCompanySocialLinks,
  collectContactSocialLinks,
  normalizeSocialUrl,
  type ClientSocialLinkValue,
} from "@/modules/clients/clientSocialLinks";
import { ClientSocialLinksDisplay } from "@/modules/clients/ClientSocialLinksDisplay";
import { CrmPhoneDisplay } from "@/modules/voice/CrmPhoneDisplay";
import { ContactQuickActions } from "@/modules/contacts/ContactQuickActions";
import {
  formatLeadWebsiteLabel,
  resolveLeadWebsiteUrl,
} from "@/modules/leads/leadBackgroundUtils";
import { useContactTabCounts } from "@/modules/contacts/useContactTabCounts";
import { LeadCenterContent } from "@/modules/leads/LeadCenterContent";

const dedupeSocialLinks = (links: ClientSocialLinkValue[]) => {
  const seen = new Set<string>();
  return links.filter((link) => {
    const url = normalizeSocialUrl(link.url).toLowerCase();
    if (!url || seen.has(url)) return false;
    seen.add(url);
    return true;
  });
};

/**
 * Single-column lead preview for the Accounts board Sheet. Mirrors the full
 * lead show identity + tabs (Pipeline, Activity, Notes, Tasks), adapted to
 * the narrower preview width — avatar left, identity block right, tabs below.
 */
export const LeadCompactPreview = () => {
  const { record, isPending } = useShowContext<Contact>();
  const companyId = record?.company_id ?? undefined;

  const { data: company } = useGetOne<Company>(
    "companies",
    { id: companyId! },
    { enabled: companyId != null },
  );

  const counts = useContactTabCounts(record);

  const socialLinks = useMemo(() => {
    if (!record) return [];
    return dedupeSocialLinks([
      ...collectCompanySocialLinks(
        company ?? { linkedin_url: "", context_links: [] },
      ),
      ...collectContactSocialLinks(record, company?.context_links),
    ]);
  }, [record, company]);

  if (isPending || !record) {
    return (
      <div className="space-y-4 p-4">
        <div className="flex gap-4">
          <Skeleton className="size-16 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const fullName = getContactFullName(record);
  const email = getContactEmail(record);
  const phoneRaw = getContactPhoneRaw(record);
  const companyName =
    record.company_name?.trim() || company?.name?.trim() || null;
  const jobOrService =
    record.title?.trim() || record.interested_service?.trim() || null;
  const address = company
    ? resolveCompanyAddressForDisplay(company)
    : resolveCompanyAddressForDisplay(record);
  const websiteUrl = resolveLeadWebsiteUrl(record, company ?? null);

  return (
    <div className="space-y-5 pb-8 pt-4">
      {/* Profile: avatar | identity block */}
      <section className="flex items-start gap-4 px-4">
        <Avatar record={record} width={64} height={64} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="min-w-0 truncate text-xl font-semibold leading-tight">
              {fullName}
              {jobOrService ? (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  | {jobOrService}
                </span>
              ) : null}
            </h2>
            <ContactQuickActions contactId={record.id} contact={record} iconRow />
          </div>

          <div className="mt-1.5 space-y-1.5 text-sm">
            {companyName ? (
              <div className="min-w-0 truncate font-medium">
                {record.company_id ? (
                  <Link
                    to={getClientShowPath(record.company_id)}
                    className="link-action truncate"
                  >
                    {companyName}
                  </Link>
                ) : (
                  companyName
                )}
              </div>
            ) : null}
            {address !== "—" ? (
              <p className="truncate text-muted-foreground">{address}</p>
            ) : null}
            {websiteUrl ? (
              <a
                href={websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="flex max-w-full items-center gap-1.5 truncate text-primary hover:underline"
              >
                <Globe className="size-3.5 shrink-0" />
                <span className="truncate">
                  {formatLeadWebsiteLabel(websiteUrl)}
                </span>
              </a>
            ) : null}
            {email !== "—" ? (
              <a
                href={`mailto:${email}`}
                className="flex max-w-full items-center gap-1.5 truncate text-muted-foreground hover:text-foreground hover:underline"
              >
                <Mail className="size-3.5 shrink-0" />
                <span className="truncate">{email}</span>
              </a>
            ) : null}
            {phoneRaw ? (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Phone className="size-3.5 shrink-0" />
                <CrmPhoneDisplay phone={phoneRaw} contactId={record.id} />
              </div>
            ) : null}
          </div>

          {socialLinks.length > 0 ? (
            <ClientSocialLinksDisplay links={socialLinks} className="mt-2" />
          ) : null}
        </div>
      </section>

      {/* Tabs mirrored from the full lead show: Pipeline (stage figures), Activity, Notes, Tasks */}
      <LeadCenterContent
        lead={record}
        companyId={counts.hasCompany ? counts.companyId : undefined}
        contactIds={counts.contactIds}
        counts={{
          notes: counts.notes,
          tasks: counts.tasks,
          tickets: counts.tickets,
        }}
      />
    </div>
  );
};
