import { DashboardInvoicesCard } from "@/modules/dashboard/DashboardInvoicesCard";
import { DashboardLeadsCard } from "@/modules/dashboard/DashboardLeadsCard";
import { DashboardTicketsCard } from "@/modules/dashboard/DashboardTicketsCard";
import { DashboardTodayTasksColumn } from "@/modules/dashboard/DashboardTodayTasksColumn";
import { DashboardWeekCalendar } from "@/modules/dashboard/DashboardWeekCalendar";
import { DashboardWelcomeHeader } from "@/modules/dashboard/DashboardWelcomeHeader";

export const DashboardHomeContent = () => (
  <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-8 xl:flex-row xl:items-start xl:gap-6">
    <div className="flex min-w-0 flex-1 flex-col gap-8">
      <DashboardWelcomeHeader />

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Your work</h2>
          <p className="text-sm text-muted-foreground">
            Some items may need a follow-up
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <DashboardLeadsCard />
          <DashboardInvoicesCard />
          <DashboardTicketsCard />
        </div>
      </section>

      <div className="xl:hidden">
        <DashboardTodayTasksColumn />
      </div>

      <DashboardWeekCalendar />
    </div>

    <aside className="hidden w-full shrink-0 xl:block xl:w-[min(420px,32vw)]">
      <DashboardTodayTasksColumn />
    </aside>
  </div>
);
