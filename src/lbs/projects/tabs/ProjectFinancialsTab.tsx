import { lazy, Suspense } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import type { LbsDeal } from "@/lbs/types";

const ProjectExpensesTab = lazy(() =>
  import("@/lbs/projects/financials/ExpensesTab").then((m) => ({
    default: m.ExpensesTab,
  })),
);
const ProjectChangeOrdersTab = lazy(() =>
  import("@/lbs/projects/financials/ChangeOrdersTab").then((m) => ({
    default: m.ChangeOrdersTab,
  })),
);
const ProjectCommissionsTab = lazy(() =>
  import("@/lbs/projects/financials/CommissionsTab").then((m) => ({
    default: m.CommissionsTab,
  })),
);
const ProjectPaymentsTab = lazy(() =>
  import("@/lbs/projects/tabs/ProjectPaymentsTab").then((m) => ({
    default: m.ProjectPaymentsTab,
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
  const canViewCommissions = useMemberCapability(
    "deal_financials.commissions.view",
  );

  const defaultTab = canViewPayments
    ? "payments"
    : canViewExpenses
      ? "expenses"
      : canViewChangeOrders
        ? "change_orders"
        : "commissions";

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Financials</h3>
        <p className="text-sm text-muted-foreground">
          Payments, expenses, change orders, and commissions for this project.
        </p>
      </div>

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
          {canViewCommissions ? (
            <TabsTrigger value="commissions" className="shrink-0">
              Commissions
            </TabsTrigger>
          ) : null}
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
        {canViewCommissions ? (
          <TabsContent value="commissions" className="pt-4">
            <Suspense fallback={<TabFallback />}>
              <ProjectCommissionsTab record={record} />
            </Suspense>
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
};
