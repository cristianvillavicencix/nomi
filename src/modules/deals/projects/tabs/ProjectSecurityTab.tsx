import { ProjectSecurityTab as ProjectCredentialsPanel } from "@/modules/deals/ProjectSecurityTab";
import { ProjectDeploymentCard } from "@/modules/deals/projects/ProjectDeploymentCard";
import { ProjectGithubLink } from "@/modules/deals/ProjectGithubLink";
import type { LbsDeal } from "@/modules/types";

export const ProjectSecurityWorkspaceTab = ({ record }: { record: LbsDeal }) => (
  <div className="space-y-6">
    <div>
      <h3 className="text-base font-semibold">Security & deployment</h3>
      <p className="text-sm text-muted-foreground">
        Repository status, live URLs, and project credentials.
      </p>
    </div>

    <ProjectGithubLink record={record} showEditLink />
    <ProjectDeploymentCard record={record} />
    <ProjectCredentialsPanel record={record} />
  </div>
);
