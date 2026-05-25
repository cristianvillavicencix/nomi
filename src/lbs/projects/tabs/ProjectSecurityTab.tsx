import { ProjectSecurityTab as ProjectCredentialsPanel } from "@/lbs/deals/ProjectSecurityTab";
import type { LbsDeal } from "@/lbs/types";

export const ProjectSecurityWorkspaceTab = ({ record }: { record: LbsDeal }) => (
  <div className="space-y-6">
    <div>
      <h3 className="text-base font-semibold">Security & credentials</h3>
      <p className="text-sm text-muted-foreground">
        Hosting, WordPress, FTP, domains, corporate email, and other internal
        logins for this project. Portal access and delivery live under Delivery.
      </p>
    </div>

    <ProjectCredentialsPanel record={record} />
  </div>
);
