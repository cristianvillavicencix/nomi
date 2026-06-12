import type { StaticAnalysisJson } from "@/modules/web-monitor/audit/types";
import { WebsiteAuditSeoExpandedPanel } from "@/modules/web-monitor/audit/WebsiteAuditSeoExpandedPanel";
import { WebsiteAuditCrawlFilesPanel } from "@/modules/web-monitor/audit/WebsiteAuditCrawlFilesPanel";
import { WebsiteAuditTechStackPanel } from "@/modules/web-monitor/audit/WebsiteAuditTechStackPanel";

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
