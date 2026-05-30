import { useState } from "react";
import { Link } from "react-router";
import { useGetList, useGetOne, type Identifier } from "ra-core";
import { Avatar } from "@/components/atomic-crm/contacts/Avatar";
import { CompanyAvatar } from "@/components/atomic-crm/companies/CompanyAvatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import { findDealLabel } from "@/components/atomic-crm/deals/deal";
import type { CompanyWithPrimaryContact } from "@/lbs/clients/clientProfile";
import {
  getPrimaryContactFullName,
  getPrimaryContactPhone,
} from "@/lbs/clients/clientProfile";
import { ClientProjectsTab, ClientTicketsTab } from "@/lbs/clients/ClientTabPanels";
import { ReferralsTab } from "@/lbs/leads/ReferralsTab";
import type { Contact, Deal } from "@/components/atomic-crm/types";
import type { Ticket } from "@/lbs/types";
import {
  getContactEmail,
  getContactFullName,
} from "@/lbs/clients/clientShowUtils";
import {
  getClientDealCreatePath,
  getClientShowPath,
  getPersonShowPath,
} from "@/lbs/routing";
import { relatedPreviewItemClassName } from "@/lbs/shared/relatedFilters";
import {
  RelatedEmptyState,
  RelatedSection,
} from "@/lbs/shared/RelatedSection";
import { MoneyText } from "@/lib/permissions/MoneyText";

type SidebarPanel =
  | "company"
  | "projects"
  | "tickets"
  | "referrals"
  | "referrer"
  | null;

type ContactRelatedSidebarProps = {
  contact: Contact;
  counts: {
    projects: number;
    tickets: number;
    referrals: number;
  };
};

export const ContactRelatedSidebar = ({
  contact,
  counts,
}: ContactRelatedSidebarProps) => {
  const [panel, setPanel] = useState<SidebarPanel>(null);
  const { dealStages } = useConfigurationContext();

  const { data: company, isPending: companyPending } =
    useGetOne<CompanyWithPrimaryContact>(
      "companies",
      { id: contact.company_id! },
      { enabled: contact.company_id != null },
    );

  const { data: referrerContact } = useGetOne<Contact>(
    "contacts",
    { id: contact.referred_by_contact_id! },
    { enabled: contact.referred_by_contact_id != null },
  );

  const { data: referrerCompany } = useGetOne<CompanyWithPrimaryContact>(
    "companies",
    { id: contact.referred_by_company_id! },
    { enabled: contact.referred_by_company_id != null },
  );

  const { data: deals = [] } = useGetList<Deal>(
    "deals",
    {
      filter: { "contact_ids@cs": `{${contact.id}}` },
      pagination: { page: 1, perPage: 3 },
      sort: { field: "updated_at", order: "DESC" },
    },
    { staleTime: 30_000 },
  );

  const { data: tickets = [] } = useGetList<Ticket>(
    "tickets",
    {
      filter: { "contact_id@eq": contact.id },
      pagination: { page: 1, perPage: 3 },
      sort: { field: "updated_at", order: "DESC" },
    },
    { staleTime: 30_000 },
  );

  const { data: referrals = [] } = useGetList<Contact>(
    "contacts",
    {
      filter: { "referred_by_contact_id@eq": contact.id },
      pagination: { page: 1, perPage: 3 },
      sort: { field: "last_seen", order: "DESC" },
    },
    { staleTime: 30_000 },
  );

  const ticketCreateParams = new URLSearchParams();
  if (contact.company_id != null) {
    ticketCreateParams.set("company_id", String(contact.company_id));
  }
  ticketCreateParams.set("contact_id", String(contact.id));

  const hasReferrer =
    contact.referred_by_contact_id != null ||
    contact.referred_by_company_id != null;

  const panelTitle =
    panel === "company"
      ? "Company"
      : panel === "projects"
        ? "Projects"
        : panel === "tickets"
          ? "Tickets"
          : panel === "referrals"
            ? "Referrals"
            : "Referred by";

  return (
    <>
      <div className="space-y-6">
        <RelatedSection
          title="Company"
          count={contact.company_id ? 1 : 0}
          empty={
            <RelatedEmptyState message="No company linked to this contact yet." />
          }
        >
          {contact.company_id && company && !companyPending ? (
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
                  {getPrimaryContactFullName(company) !== "—" ? (
                    <p className="truncate text-sm text-muted-foreground">
                      {getPrimaryContactFullName(company)}
                    </p>
                  ) : null}
                  {getPrimaryContactPhone(company) !== "—" ? (
                    <p className="truncate text-sm text-muted-foreground">
                      {getPrimaryContactPhone(company)}
                    </p>
                  ) : null}
                </div>
              </div>
            </Link>
          ) : null}
        </RelatedSection>

        {hasReferrer ? (
          <RelatedSection
            title="Referred by"
            count={1}
            onViewAll={() => setPanel("referrer")}
          >
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
                    <p className="truncate text-sm text-muted-foreground">
                      Contact
                    </p>
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
                    <p className="truncate text-sm text-muted-foreground">
                      Company
                    </p>
                  </div>
                </div>
              </Link>
            ) : null}
          </RelatedSection>
        ) : null}

        <RelatedSection
          title="Projects"
          count={counts.projects}
          addHref={
            contact.company_id
              ? getClientDealCreatePath(contact.company_id, contact.id)
              : undefined
          }
          onViewAll={() => setPanel("projects")}
          empty={
            <RelatedEmptyState message="No projects linked to this contact yet." />
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
            <RelatedEmptyState message="No support tickets for this contact." />
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
            <RelatedEmptyState message="This contact has not referred anyone yet." />
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
            {panel === "projects" ? (
              <ClientProjectsTab contactId={contact.id} />
            ) : null}
            {panel === "tickets" && contact.company_id ? (
              <ClientTicketsTab companyId={contact.company_id} />
            ) : null}
            {panel === "referrals" ? (
              <ReferralsTab referrerContactId={contact.id} />
            ) : null}
            {panel === "referrer" ? (
              <div className="space-y-3">
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
                {referrerCompany ? (
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
              </div>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
