import type { StaticAnalysisJson } from "@/lbs/website-monitor/audit/types";
import { WebsiteAuditSeoExpandedPanel } from "@/lbs/website-monitor/audit/WebsiteAuditSeoExpandedPanel";
import { WebsiteAuditCrawlFilesPanel } from "@/lbs/website-monitor/audit/WebsiteAuditCrawlFilesPanel";
import { WebsiteAuditTechStackPanel } from "@/lbs/website-monitor/audit/WebsiteAuditTechStackPanel";

export const WebsiteAuditSeoTechPanel = ({
  staticJson,
}: {
  staticJson: StaticAnalysisJson;
}) => (
  <div className="space-y-10">
    <WebsiteAuditSeoExpandedPanel staticJson={staticJson} />
    <WebsiteAuditCrawlFilesPanel staticJson={staticJson} />
    <WebsiteAuditTechStackPanel staticJson={staticJson} />
  </div>
);
