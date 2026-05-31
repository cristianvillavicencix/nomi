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
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import { findDealLabel } from "@/components/atomic-crm/deals/deal";
import type { Company, Contact, Deal } from "@/components/atomic-crm/types";
import type { Ticket } from "@/lbs/types";
import { ClientContactsTab } from "@/lbs/clients/ClientContactsTab";
import { ClientProjectsTab, ClientTicketsTab } from "@/lbs/clients/ClientTabPanels";
import { ReferralsTab } from "@/lbs/leads/ReferralsTab";
import { useWebsiteMonitorEnabled } from "@/lbs/settings/useWebsiteMonitorSettings";
import { WebsiteMonitorStatusWidget } from "@/lbs/website-monitor/WebsiteMonitorStatusWidget";
import { WebsiteMonitorAuditWidget } from "@/lbs/website-monitor/WebsiteMonitorAuditWidget";
import {
  getContactEmail,
  getContactFullName,
} from "@/lbs/clients/clientShowUtils";
import {
  getClientDealCreatePath,
  getLeadShowPath,
  getPersonShowPath,
} from "@/lbs/routing";
import { getLeadStageDef } from "@/lbs/leads/leadStages";
import {
  CONTACT_STATUS_FILTER,
  LEAD_STATUS_FILTER,
  relatedPreviewItemClassName,
} from "@/lbs/shared/relatedFilters";
import {
  RelatedEmptyState,
  RelatedSection,
} from "@/lbs/shared/RelatedSection";
import { MoneyText } from "@/lib/permissions/MoneyText";

type SidebarPanel =
  | "contacts"
  | "leads"
  | "projects"
  | "tickets"
  | "referrals"
  | null;

type ClientRelatedSidebarProps = {
  companyId: Company["id"];
  primaryContactId?: Identifier | null;
  counts: {
    contacts: number;
    leads: number;
    projects: number;
    tickets: number;
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
  const { dealStages } = useConfigurationContext();
  const { enabled: webMonitorEnabled } = useWebsiteMonitorEnabled();

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

  const { data: deals = [] } = useGetList<Deal>(
    "deals",
    {
      filter: { "company_id@eq": companyId },
      pagination: { page: 1, perPage: 3 },
      sort: { field: "updated_at", order: "DESC" },
    },
    { staleTime: 30_000 },
  );

  const { data: tickets = [] } = useGetList<Ticket>(
    "tickets",
    {
      filter: { "company_id@eq": companyId },
      pagination: { page: 1, perPage: 3 },
      sort: { field: "updated_at", order: "DESC" },
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

  const ticketCreateParams = new URLSearchParams({
    company_id: String(companyId),
  });
  if (primaryContactId != null) {
    ticketCreateParams.set("contact_id", String(primaryContactId));
  }

  const panelTitle =
    panel === "contacts"
      ? "Contacts"
      : panel === "leads"
        ? "Leads"
        : panel === "projects"
          ? "Projects"
          : panel === "tickets"
            ? "Tickets"
            : "Referrals";

  return (
    <>
      <div className="space-y-6">
        {webMonitorEnabled ? (
          <>
            <RelatedSection title="Estado web" count={0} forceShow>
              <WebsiteMonitorStatusWidget companyId={companyId} variant="plain" />
            </RelatedSection>
            <RelatedSection title="Web Report" count={0} forceShow>
              <WebsiteMonitorAuditWidget companyId={companyId} variant="plain" />
            </RelatedSection>
          </>
        ) : null}

        <RelatedSection
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
                      <Badge variant="outline" className="text-[10px] capitalize">
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
          title="Projects"
          count={counts.projects}
          addHref={getClientDealCreatePath(companyId, primaryContactId)}
          onViewAll={() => setPanel("projects")}
          empty={
            <RelatedEmptyState message="No projects for this company yet." />
          }
        >
          <div className="space-y-2">
            {deals.map((deal) => (
              <Link
                key={deal.id}
                to={`/deals/${deal.id}/show`}
                className={relatedPreviewItemClassName}
              >
                <p className="font-medium">{deal.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>{findDealLabel(dealStages, deal.stage)}</span>
                  <MoneyText value={deal.amount} />
                </div>
              </Link>
            ))}
          </div>
        </RelatedSection>

        <RelatedSection
          title="Tickets"
          count={counts.tickets}
          addHref={`/tickets/create?${ticketCreateParams.toString()}`}
          onViewAll={() => setPanel("tickets")}
          empty={
            <RelatedEmptyState message="No support tickets for this company." />
          }
        >
          <div className="space-y-2">
            {tickets.map((ticket) => (
              <Link
                key={ticket.id}
                to={`/tickets/${ticket.id}/show`}
                className={relatedPreviewItemClassName}
              >
                <p className="font-medium">
                  {ticket.subject ?? `Ticket #${ticket.id}`}
                </p>
                {ticket.status ? (
                  <p className="text-sm capitalize text-muted-foreground">
                    {ticket.status.replace(/_/g, " ")}
                  </p>
                ) : null}
              </Link>
            ))}
          </div>
        </RelatedSection>

        <RelatedSection
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
                    <p className="font-medium">{getContactFullName(referral)}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {getContactEmail(referral)}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </RelatedSection>
      </div>

      <Sheet open={panel != null} onOpenChange={(open) => !open && setPanel(null)}>
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
            {panel === "projects" ? (
              <ClientProjectsTab companyId={companyId} />
            ) : null}
            {panel === "tickets" ? (
              <ClientTicketsTab companyId={companyId} />
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
