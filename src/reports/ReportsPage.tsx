import { useEffect } from "react";
import { useGetIdentity } from "ra-core";
import { useNavigate } from "react-router";
import {
  PageLayout,
  ScrollableContentArea,
  StickyPageHeader,
} from "@/components/atomic-crm/layout/page-shell";
import { ModuleInfoPopover } from "@/components/atomic-crm/layout/ModuleInfoPopover";
import { getAccessRoles } from "@/components/atomic-crm/providers/commons/canAccess";
import { WebAgencyMetricsReportPage } from "./WebAgencyMetricsReportPage";

export type ReportTab = "web-agency-metrics";

export const ReportsPage = (_props: { initialTab?: ReportTab }) => {
  const navigate = useNavigate();
  const { data: identity } = useGetIdentity();
  const roles = getAccessRoles(identity as any);
  const canViewLbsReports =
    roles.includes("admin") ||
    roles.includes("sales_manager") ||
    roles.includes("user");

  useEffect(() => {
    if (!canViewLbsReports) {
      navigate("/", { replace: true });
    }
  }, [canViewLbsReports, navigate]);

  if (!canViewLbsReports) {
    return null;
  }

  return (
    <PageLayout>
      <StickyPageHeader className="pb-2">
        <div className="flex items-center justify-end">
          <ModuleInfoPopover
            title="Reports"
            description="Win rate, closed deals, and revenue trends for your web agency pipeline."
          />
        </div>
      </StickyPageHeader>
      <ScrollableContentArea>
        <WebAgencyMetricsReportPage embedded />
      </ScrollableContentArea>
    </PageLayout>
  );
};
