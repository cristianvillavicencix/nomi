import { Briefcase, Handshake, LifeBuoy, UserRound, Users } from "lucide-react";
import type { ComponentProps } from "react";
import { ClientRelatedSidebar } from "@/lbs/clients/ClientRelatedSidebar";
import { CollapsibleRelatedPanel } from "@/lbs/shared/CollapsibleRelatedPanel";

const STORAGE_KEY = "lbs_client_related_sidebar_collapsed";

type ClientCollapsibleRelatedSidebarProps = ComponentProps<
  typeof ClientRelatedSidebar
>;

export const ClientCollapsibleRelatedSidebar = (
  props: ClientCollapsibleRelatedSidebarProps,
) => {
  const { counts } = props;

  return (
    <CollapsibleRelatedPanel
      storageKey={STORAGE_KEY}
      collapsedIcons={[
        {
          key: "contacts",
          icon: <Users className="size-4" />,
          count: counts.contacts,
          label: "Contacts",
        },
        {
          key: "leads",
          icon: <UserRound className="size-4" />,
          count: counts.leads,
          label: "Leads",
        },
        {
          key: "projects",
          icon: <Briefcase className="size-4" />,
          count: counts.projects,
          label: "Projects",
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
      <ClientRelatedSidebar {...props} />
    </CollapsibleRelatedPanel>
  );
};
