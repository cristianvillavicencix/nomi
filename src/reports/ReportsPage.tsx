import { useEffect, useState } from "react";
import { useGetIdentity } from "ra-core";
import { useLocation, useNavigate } from "react-router";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  PageLayout,
  ScrollableContentArea,
  StickyPageHeader,
  StickyTabsBar,
} from "@/components/atomic-crm/layout/page-shell";
import { ModuleInfoPopover } from "@/components/atomic-crm/layout/ModuleInfoPopover";
import { getAccessRoles } from "@/components/atomic-crm/providers/commons/canAccess";
import { LaborCostByPersonReportPage } from "./LaborCostByPersonReportPage";
import { PayrollSummaryReportPage } from "./PayrollSummaryReportPage";
import { ProjectProfitabilityReportPage } from "./ProjectProfitabilityReportPage";
import { SalesCommissionsReportPage } from "./SalesCommissionsReportPage";

export type ReportTab =
  | "project-profitability"
  | "payroll-summary"
  | "labor-cost-by-person"
  | "sales-commissions";

export const ReportsPage = ({ initialTab }: { initialTab?: ReportTab }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: identity } = useGetIdentity();
  const roles = getAccessRoles(identity as any);
  const canViewFinanceReports =
    roles.includes("admin") || roles.includes("accountant") || roles.includes("payroll_manager");
  const canViewPeopleReports = canViewFinanceReports || roles.includes("hr");
  const canViewSalesReports = roles.includes("admin") || roles.includes("sales_manager");
  const availableTabs: ReportTab[] = [
    ...(canViewSalesReports ? (["project-profitability"] as ReportTab[]) : []),
    ...(canViewFinanceReports ? (["payroll-summary"] as ReportTab[]) : []),
    ...(canViewPeopleReports ? (["labor-cost-by-person"] as ReportTab[]) : []),
    ...(canViewSalesReports ? (["sales-commissions"] as ReportTab[]) : []),
  ];

  const getTabFromPath = (): ReportTab => {
    if (location.pathname.includes("/reports/payroll-summary")) {
      return "payroll-summary";
    }
    if (location.pathname.includes("/reports/labor-cost-by-person")) {
      return "labor-cost-by-person";
    }
    if (location.pathname.includes("/reports/sales-commissions")) {
      return "sales-commissions";
    }
    return initialTab ?? "project-profitability";
  };

  const fallbackTab = availableTabs[0] ?? "project-profitability";
  const [tab, setTab] = useState<ReportTab>(getTabFromPath());

  useEffect(() => {
    const nextTab = getTabFromPath();
    setTab(availableTabs.includes(nextTab) ? nextTab : fallbackTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableTabs.join(","), location.pathname, initialTab, fallbackTab]);

  useEffect(() => {
    if (!availableTabs.length) {
      navigate("/", { replace: true });
      return;
    }

    const nextTab = getTabFromPath();
    if (!availableTabs.includes(nextTab)) {
      navigate(`/reports/${fallbackTab}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableTabs.join(","), fallbackTab, navigate]);

  const handleTabChange = (next: string) => {
    const nextTab = next as ReportTab;
    if (!availableTabs.includes(nextTab)) return;
    setTab(nextTab);
    navigate(`/reports/${nextTab}`);
  };

  return (
    <PageLayout>
      <StickyPageHeader className="pb-2">
        <div className="flex items-center justify-end">
          <ModuleInfoPopover
            title="Reports"
            description="Executive visibility across profitability, payroll, labor, and commissions."
          />
        </div>
      </StickyPageHeader>
      <Tabs value={tab} onValueChange={handleTabChange} className="flex min-h-0 flex-1 flex-col">
        <StickyTabsBar className="pb-2">
          <div className="overflow-x-auto">
            <TabsList className="inline-flex h-10 w-max min-w-full items-center justify-start gap-1">
              {canViewSalesReports ? (
                <TabsTrigger value="project-profitability">
                  Project Profitability
                </TabsTrigger>
              ) : null}
              {canViewFinanceReports ? (
                <TabsTrigger value="payroll-summary">Payroll Summary</TabsTrigger>
              ) : null}
              {canViewPeopleReports ? (
                <TabsTrigger value="labor-cost-by-person">
                  Labor Cost by Person
                </TabsTrigger>
              ) : null}
              {canViewSalesReports ? (
                <TabsTrigger value="sales-commissions">
                  Sales Commissions
                </TabsTrigger>
              ) : null}
            </TabsList>
          </div>
        </StickyTabsBar>

        <ScrollableContentArea>
          {canViewSalesReports ? (
            <TabsContent value="project-profitability" className="pt-2">
              <ProjectProfitabilityReportPage embedded />
            </TabsContent>
          ) : null}
          {canViewFinanceReports ? (
            <TabsContent value="payroll-summary" className="pt-2">
              <PayrollSummaryReportPage embedded />
            </TabsContent>
          ) : null}
          {canViewPeopleReports ? (
            <TabsContent value="labor-cost-by-person" className="pt-2">
              <LaborCostByPersonReportPage embedded />
            </TabsContent>
          ) : null}
          {canViewSalesReports ? (
            <TabsContent value="sales-commissions" className="pt-2">
              <SalesCommissionsReportPage embedded />
            </TabsContent>
          ) : null}
        </ScrollableContentArea>
      </Tabs>
    </PageLayout>
  );
};
