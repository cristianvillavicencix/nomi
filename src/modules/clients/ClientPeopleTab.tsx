import { Button } from "@/components/ui/button";
import type { Company, Identifier } from "ra-core";
import { ClientContactsTab } from "@/modules/clients/ClientContactsTab";
import { ClientTabSectionCard } from "@/modules/clients/ClientTabSectionCard";
import { ReferralsTab } from "@/modules/leads/ReferralsTab";
import type { CompanyWithPrimaryContact } from "@/modules/clients/clientProfile";

type ClientPeopleTabProps = {
  companyId: Company["id"] | Identifier;
  primaryContactId?: CompanyWithPrimaryContact["primary_contact_id"];
  counts: {
    contacts: number;
    leads: number;
    referrals: number;
  };
  onAddContact: () => void;
};

export const ClientPeopleTab = ({
  companyId,
  primaryContactId,
  counts,
  onAddContact,
}: ClientPeopleTabProps) => (
  <div className="space-y-6">
    <ClientTabSectionCard
      title="Contacts"
      count={counts.contacts}
      action={
        <Button type="button" size="sm" variant="outline" onClick={onAddContact}>
          Add contact
        </Button>
      }
    >
      <ClientContactsTab
        companyId={companyId}
        primaryContactId={primaryContactId}
        statusFilter="contacts"
      />
    </ClientTabSectionCard>

    <ClientTabSectionCard title="Leads" count={counts.leads}>
      <ClientContactsTab
        companyId={companyId}
        primaryContactId={primaryContactId}
        statusFilter="leads"
      />
    </ClientTabSectionCard>

    <ClientTabSectionCard title="Referrals" count={counts.referrals}>
      <ReferralsTab referrerCompanyId={companyId} />
    </ClientTabSectionCard>
  </div>
);
