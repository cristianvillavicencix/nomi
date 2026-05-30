import { Link } from "react-router";
import { useGetOne } from "ra-core";
import { Avatar } from "@/components/atomic-crm/contacts/Avatar";
import { CompanyAvatar } from "@/components/atomic-crm/companies/CompanyAvatar";
import type { CompanyWithPrimaryContact } from "@/lbs/clients/clientProfile";
import type { Contact } from "@/components/atomic-crm/types";
import { getContactFullName } from "@/lbs/clients/clientShowUtils";
import {
  getClientShowPath,
  getPersonShowPath,
} from "@/lbs/routing";
import { relatedPreviewItemClassName } from "@/lbs/shared/relatedFilters";
import {
  RelatedEmptyState,
  RelatedSection,
} from "@/lbs/shared/RelatedSection";
import { RelatedSocialLinksSection } from "@/lbs/shared/RelatedSocialLinksSection";

type LeadRelatedSidebarProps = {
  lead: Contact;
};

export const LeadRelatedSidebar = ({ lead }: LeadRelatedSidebarProps) => {
  const { data: company, isPending: companyPending } =
    useGetOne<CompanyWithPrimaryContact>(
      "companies",
      { id: lead.company_id! },
      { enabled: lead.company_id != null },
    );

  const { data: referrerContact } = useGetOne<Contact>(
    "contacts",
    { id: lead.referred_by_contact_id! },
    { enabled: lead.referred_by_contact_id != null },
  );

  const { data: referrerCompany } = useGetOne<CompanyWithPrimaryContact>(
    "companies",
    { id: lead.referred_by_company_id! },
    { enabled: lead.referred_by_company_id != null },
  );

  const hasReferrer =
    lead.referred_by_contact_id != null ||
    lead.referred_by_company_id != null;

  return (
    <div className="space-y-6">
      <RelatedSection
        title="Company"
        count={lead.company_id ? 1 : lead.company_name?.trim() ? 1 : 0}
        forceShow={!!lead.company_name?.trim()}
        empty={
          <RelatedEmptyState message="No company linked yet. One can be created when you convert this lead." />
        }
      >
        {lead.company_id && company && !companyPending ? (
          <Link
            to={getClientShowPath(company.id)}
            className={relatedPreviewItemClassName}
          >
            <div className="flex items-start gap-3">
              <CompanyAvatar record={company} width={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {company.name?.trim() || "—"}
                </p>
                <p className="text-sm text-muted-foreground">Linked company</p>
              </div>
            </div>
          </Link>
        ) : lead.company_name?.trim() ? (
          <div className={relatedPreviewItemClassName}>
            <p className="font-medium">{lead.company_name.trim()}</p>
            <p className="text-sm text-muted-foreground">
              Name on file — not converted yet
            </p>
          </div>
        ) : null}
      </RelatedSection>

      {hasReferrer ? (
        <RelatedSection title="Referred by" count={1}>
          {referrerContact ? (
            <Link
              to={getPersonShowPath(referrerContact)}
              className={relatedPreviewItemClassName}
            >
              <div className="flex items-start gap-3">
                <Avatar record={referrerContact} width={32} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {getContactFullName(referrerContact)}
                  </p>
                  <p className="text-sm text-muted-foreground">Contact</p>
                </div>
              </div>
            </Link>
          ) : null}
          {!referrerContact && referrerCompany ? (
            <Link
              to={getClientShowPath(referrerCompany.id)}
              className={relatedPreviewItemClassName}
            >
              <div className="flex items-start gap-3">
                <CompanyAvatar record={referrerCompany} width={32} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {referrerCompany.name?.trim() || "—"}
                  </p>
                  <p className="text-sm text-muted-foreground">Company</p>
                </div>
              </div>
            </Link>
          ) : null}
        </RelatedSection>
      ) : null}

      <RelatedSocialLinksSection contact={lead} />
    </div>
  );
};
