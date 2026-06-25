import { lazy, Suspense } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import { ProfitSummaryCard } from "@/modules/deals/projects/financials/ProfitSummaryCard";
import type { LbsDeal } from "@/modules/types";

const ProjectScopeTab = lazy(() =>
  import("@/modules/deals/projects/tabs/ProjectScopeTab").then((m) => ({
    default: m.ProjectScopeTab,
  })),
);
const ProjectExpensesTab = lazy(() =>
  import("@/modules/deals/projects/financials/ExpensesTab").then((m) => ({
    default: m.ExpensesTab,
  })),
);
const ProjectChangeOrdersTab = lazy(() =>
  import("@/modules/deals/projects/financials/ChangeOrdersTab").then((m) => ({
    default: m.ChangeOrdersTab,
  })),
);
const ProjectPaymentsTab = lazy(() =>
  import("@/modules/deals/projects/tabs/ProjectPaymentsTab").then((m) => ({
    default: m.ProjectPaymentsTab,
  })),
);
const MaintenanceTab = lazy(() =>
  import("@/modules/deals/projects/tabs/MaintenanceTab").then((m) => ({
    default: m.MaintenanceTab,
  })),
);

const TabFallback = () => <Skeleton className="h-40 w-full rounded-lg" />;

export const ProjectFinancialsTab = ({ record }: { record: LbsDeal }) => {
  const canViewExpenses = useMemberCapability("deal_financials.expenses.view");
  const canViewChangeOrders = useMemberCapability(
    "deal_financials.change_orders.view",
  );
  const canViewPayments = useMemberCapability(
    "deal_financials.collections.view",
  );
  const canViewCollections = useMemberCapability(
    "deal_financials.collections.view",
  );

  const defaultTab = canViewPayments
    ? "payments"
    : canViewExpenses
      ? "expenses"
      : "change_orders";

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Financials</h3>
        <p className="text-sm text-muted-foreground">
          Sold scope, profit summary, payments, expenses, and change orders.
        </p>
      </div>

      <Suspense fallback={<TabFallback />}>
        <ProjectScopeTab record={record} />
      </Suspense>

      {canViewCollections ? <ProfitSummaryCard record={record} /> : null}

      <Tabs defaultValue={defaultTab}>
        <TabsList className="inline-flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg bg-muted p-1">
          {canViewPayments ? (
            <TabsTrigger value="payments" className="shrink-0">
              Payments
            </TabsTrigger>
          ) : null}
          {canViewExpenses ? (
            <TabsTrigger value="expenses" className="shrink-0">
              Expenses
            </TabsTrigger>
          ) : null}
          {canViewChangeOrders ? (
            <TabsTrigger value="change_orders" className="shrink-0">
              Change orders
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="maintenance" className="shrink-0">
            Maintenance
          </TabsTrigger>
        </TabsList>

        {canViewPayments ? (
          <TabsContent value="payments" className="pt-4">
            <Suspense fallback={<TabFallback />}>
              <ProjectPaymentsTab record={record} />
            </Suspense>
          </TabsContent>
        ) : null}
        {canViewExpenses ? (
          <TabsContent value="expenses" className="pt-4">
            <Suspense fallback={<TabFallback />}>
              <ProjectExpensesTab record={record} />
            </Suspense>
          </TabsContent>
        ) : null}
        {canViewChangeOrders ? (
          <TabsContent value="change_orders" className="pt-4">
            <Suspense fallback={<TabFallback />}>
              <ProjectChangeOrdersTab record={record} />
            </Suspense>
          </TabsContent>
        ) : null}
        <TabsContent value="maintenance" className="pt-4">
          <Suspense fallback={<TabFallback />}>
            <MaintenanceTab record={record} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
};
