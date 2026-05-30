import { Building2, Share2, UserRound } from "lucide-react";
import type { ComponentProps } from "react";
import { collectContactSocialLinks } from "@/lbs/clients/clientSocialLinks";
import { LeadRelatedSidebar } from "@/lbs/leads/LeadRelatedSidebar";
import { CollapsibleRelatedPanel } from "@/lbs/shared/CollapsibleRelatedPanel";

const STORAGE_KEY = "lbs_lead_related_sidebar_collapsed";

type LeadCollapsibleRelatedSidebarProps = ComponentProps<
  typeof LeadRelatedSidebar
>;

export const LeadCollapsibleRelatedSidebar = (
  props: LeadCollapsibleRelatedSidebarProps,
) => {
  const { lead } = props;
  const socialCount = collectContactSocialLinks(lead).length;

  return (
    <CollapsibleRelatedPanel
      storageKey={STORAGE_KEY}
      collapsedIcons={[
        {
          key: "company",
          icon: <Building2 className="size-4" />,
          count: lead.company_id ? 1 : 0,
          label: "Company",
        },
        {
          key: "referrer",
          icon: <UserRound className="size-4" />,
          count:
            lead.referred_by_contact_id != null ||
            lead.referred_by_company_id != null
              ? 1
              : 0,
          label: "Referred by",
        },
        {
          key: "social",
          icon: <Share2 className="size-4" />,
          count: socialCount,
          label: "Social links",
        },
      ]}
    >
      <LeadRelatedSidebar {...props} />
    </CollapsibleRelatedPanel>
  );
};
