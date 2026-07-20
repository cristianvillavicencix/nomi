import { Building2, Handshake, LifeBuoy, UserRound } from "lucide-react";
import type { ComponentProps } from "react";
import { ContactRelatedSidebar } from "@/modules/contacts/ContactRelatedSidebar";
import { CollapsibleRelatedPanel } from "@/modules/shared/CollapsibleRelatedPanel";

const STORAGE_KEY = "lbs_contact_related_sidebar_collapsed";

type ContactCollapsibleRelatedSidebarProps = ComponentProps<
  typeof ContactRelatedSidebar
>;

export const ContactCollapsibleRelatedSidebar = (
  props: ContactCollapsibleRelatedSidebarProps,
) => {
  const { contact, counts } = props;

  return (
    <CollapsibleRelatedPanel
      storageKey={STORAGE_KEY}
      collapsedIcons={[
        {
          key: "company",
          icon: <Building2 className="size-4" />,
          count: contact.company_id ? 1 : 0,
          label: "Company",
        },
        {
          key: "referrer",
          icon: <UserRound className="size-4" />,
          count:
            contact.referred_by_contact_id != null ||
            contact.referred_by_company_id != null
              ? 1
              : 0,
          label: "Referred by",
        },
        {
          key: "tickets",
          icon: <LifeBuoy className="size-4" />,
          count: counts.tickets,
          label: "Tickets",
        },
        {
          key: "referrals",
          icon: <Handshake className="size-4" />,
          count: counts.referrals,
          label: "Referrals",
        },
      ]}
    >
      <ContactRelatedSidebar {...props} />
    </CollapsibleRelatedPanel>
  );
};
