import { ProjectSecurityTab as ProjectAccountsPanel } from "@/modules/deals/ProjectSecurityTab";
import { ProjectDomainsCard } from "@/modules/deals/projects/ProjectDomainsCard";
import { ProjectEnvVarsCard } from "@/modules/deals/projects/ProjectEnvVarsCard";
import { ProjectHostingCard } from "@/modules/deals/projects/ProjectHostingCard";
import { ProjectOverviewSecurityCard } from "@/modules/deals/projects/ProjectOverviewSecurityCard";
import type { LbsDeal } from "@/modules/types";

export const ProjectSecurityWorkspaceTab = ({
  record,
}: {
  record: LbsDeal;
}) => (
  <div className="divide-y divide-border/50">
    <div className="pb-7">
      <ProjectOverviewSecurityCard record={record} />
    </div>
    <div className="py-7">
      <ProjectDomainsCard record={record} />
    </div>
    <div className="py-7">
      <ProjectHostingCard record={record} />
    </div>
    <div className="py-7">
      <ProjectEnvVarsCard record={record} />
    </div>
    <div className="space-y-3 pt-7">
      <h3 className="text-sm font-semibold">Accounts &amp; links</h3>
      <ProjectAccountsPanel record={record} />
    </div>
  </div>
);
