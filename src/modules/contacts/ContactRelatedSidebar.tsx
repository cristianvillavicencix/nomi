import { useState } from "react";
import { Link } from "react-router";
import { useGetList, useGetOne } from "ra-core";
import { Avatar } from "@/components/atomic-crm/contacts/Avatar";
import { CompanyAvatar } from "@/components/atomic-crm/companies/CompanyAvatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { CompanyWithPrimaryContact } from "@/modules/clients/clientProfile";
import {
  getPrimaryContactFullName,
  getPrimaryContactPhoneRaw,
} from "@/modules/clients/clientProfile";
import { CrmPhoneDisplay } from "@/modules/voice/CrmPhoneDisplay";
import { ClientTicketsTab } from "@/modules/clients/ClientTabPanels";
import { ReferralsTab } from "@/modules/leads/ReferralsTab";
import type { Contact } from "@/components/atomic-crm/types";
import type { Ticket } from "@/modules/types";
import {
  getContactEmail,
  getContactFullName,
} from "@/modules/clients/clientShowUtils";
import {
  getClientShowPath,
  getPersonShowPath,
} from "@/app/routing";
import { relatedPreviewItemClassName } from "@/modules/shared/relatedFilters";
import {
  RelatedAccordion,
  RelatedEmptyState,
  RelatedSection,
} from "@/modules/shared/RelatedSection";

type SidebarPanel = "company" | "tickets" | "referrals" | "referrer" | null;

type ContactRelatedSidebarProps = {
  contact: Contact;
  counts: {
    tickets: number;
    referrals: number;
  };
};

export const ContactRelatedSidebar = ({
  contact,
  counts,
}: ContactRelatedSidebarProps) => {
  const [panel, setPanel] = useState<SidebarPanel>(null);

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
      : panel === "tickets"
        ? "Tickets"
        : panel === "referrals"
          ? "Referrals"
          : "Referred by";

  return (
    <>
      <RelatedAccordion defaultValue={["company"]}>
        <RelatedSection
          value="company"
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
                  {getPrimaryContactPhoneRaw(company) ? (
                    <p className="truncate text-sm text-muted-foreground">
                      <CrmPhoneDisplay
                        phone={getPrimaryContactPhoneRaw(company)}
                        contactId={company.primary_contact_id}
                        className="link-action"
                      />
                    </p>
                  ) : null}
                </div>
              </div>
            </Link>
          ) : null}
        </RelatedSection>

        {hasReferrer ? (
          <RelatedSection
            value="referrer"
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
          value="tickets"
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
          value="referrals"
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
            {panel === "tickets" ? (
              <ClientTicketsTab
                companyId={contact.company_id ?? undefined}
                contactId={contact.id}
                scope="contact"
              />
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
