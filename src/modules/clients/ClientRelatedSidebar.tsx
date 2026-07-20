import { useState } from "react";
import { Link } from "react-router";
import { useGetList, type Identifier } from "ra-core";
import { Avatar } from "@/components/atomic-crm/contacts/Avatar";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Company, Contact } from "@/components/atomic-crm/types";
import { ClientContactsTab } from "@/modules/clients/ClientContactsTab";
import { ReferralsTab } from "@/modules/leads/ReferralsTab";
import {
  getContactEmail,
  getContactFullName,
} from "@/modules/clients/clientShowUtils";
import { getLeadShowPath, getPersonShowPath } from "@/app/routing";
import { getLeadStageDef } from "@/modules/leads/leadStages";
import {
  CONTACT_STATUS_FILTER,
  LEAD_STATUS_FILTER,
  relatedPreviewItemClassName,
} from "@/modules/shared/relatedFilters";
import {
  RelatedAccordion,
  RelatedEmptyState,
  RelatedSection,
} from "@/modules/shared/RelatedSection";

type SidebarPanel = "contacts" | "leads" | "referrals" | null;

type ClientRelatedSidebarProps = {
  companyId: Company["id"];
  primaryContactId?: Identifier | null;
  counts: {
    contacts: number;
    leads: number;
    referrals: number;
  };
  onAddContact: () => void;
  onOpenContact: (contactId: Identifier) => void;
};

export const ClientRelatedSidebar = ({
  companyId,
  primaryContactId,
  counts,
  onAddContact,
  onOpenContact,
}: ClientRelatedSidebarProps) => {
  const [panel, setPanel] = useState<SidebarPanel>(null);
  const { data: contacts = [] } = useGetList<Contact>(
    "contacts",
    {
      filter: {
        "company_id@eq": companyId,
        "status@in": CONTACT_STATUS_FILTER,
      },
      pagination: { page: 1, perPage: 3 },
      sort: { field: "last_name", order: "ASC" },
    },
    { staleTime: 30_000 },
  );

  const { data: leads = [] } = useGetList<Contact>(
    "contacts",
    {
      filter: {
        "company_id@eq": companyId,
        "status@in": LEAD_STATUS_FILTER,
      },
      pagination: { page: 1, perPage: 3 },
      sort: { field: "last_seen", order: "DESC" },
    },
    { staleTime: 30_000 },
  );

  const { data: referrals = [] } = useGetList<Contact>(
    "contacts",
    {
      filter: { "referred_by_company_id@eq": companyId },
      pagination: { page: 1, perPage: 3 },
      sort: { field: "last_seen", order: "DESC" },
    },
    { staleTime: 30_000 },
  );

  const panelTitle =
    panel === "contacts"
      ? "Contacts"
      : panel === "leads"
        ? "Leads"
        : "Referrals";

  return (
    <>
      <RelatedAccordion defaultValue={["contacts"]}>
        <RelatedSection
          value="contacts"
          title="Contacts"
          count={counts.contacts}
          onAdd={onAddContact}
          onViewAll={() => setPanel("contacts")}
          empty={
            <RelatedEmptyState message="No contacts linked to this company yet." />
          }
        >
          <div className="space-y-3">
            {contacts.map((contact) => {
              const isPrimary =
                primaryContactId != null &&
                String(contact.id) === String(primaryContactId);

              return (
                <button
                  key={contact.id}
                  type="button"
                  className={relatedPreviewItemClassName}
                  onClick={() => onOpenContact(contact.id)}
                >
                  <div className="flex items-start gap-3">
                    <Avatar record={contact} width={32} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">
                          {getContactFullName(contact)}
                        </span>
                        {isPrimary ? (
                          <Badge variant="secondary" className="text-[10px]">
                            Primary
                          </Badge>
                        ) : null}
                      </div>
                      <p className="truncate text-sm text-muted-foreground">
                        {getContactEmail(contact)}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </RelatedSection>

        <RelatedSection
          value="leads"
          title="Leads"
          count={counts.leads}
          onViewAll={() => setPanel("leads")}
          empty={
            <RelatedEmptyState message="No open leads linked to this company." />
          }
        >
          <div className="space-y-3">
            {leads.map((lead) => (
              <Link
                key={lead.id}
                to={getLeadShowPath(lead.id)}
                className={relatedPreviewItemClassName}
              >
                <div className="flex items-start gap-3">
                  <Avatar record={lead} width={32} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {getContactFullName(lead)}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] capitalize"
                      >
                        {getLeadStageDef(lead.lead_stage).label}
                      </Badge>
                    </div>
                    {lead.interested_service ? (
                      <p className="truncate text-sm text-muted-foreground">
                        {lead.interested_service}
                      </p>
                    ) : (
                      <p className="truncate text-sm text-muted-foreground">
                        {getContactEmail(lead)}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </RelatedSection>

        <RelatedSection
          value="referrals"
          title="Referrals"
          count={counts.referrals}
          onViewAll={() => setPanel("referrals")}
          empty={
            <RelatedEmptyState message="No referrals attributed to this company yet." />
          }
        >
          <div className="space-y-3">
            {referrals.map((referral) => (
              <Link
                key={referral.id}
                to={getPersonShowPath(referral)}
                className={relatedPreviewItemClassName}
              >
                <div className="flex items-start gap-3">
                  <Avatar record={referral} width={32} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {getContactFullName(referral)}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {getContactEmail(referral)}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </RelatedSection>
      </RelatedAccordion>

      <Sheet
        open={panel != null}
        onOpenChange={(open) => !open && setPanel(null)}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{panelTitle}</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            {panel === "contacts" ? (
              <ClientContactsTab
                companyId={companyId}
                primaryContactId={primaryContactId}
              />
            ) : null}
            {panel === "leads" ? (
              <ClientContactsTab
                companyId={companyId}
                primaryContactId={primaryContactId}
                statusFilter="leads"
              />
            ) : null}
            {panel === "referrals" ? (
              <ReferralsTab referrerCompanyId={companyId} />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
