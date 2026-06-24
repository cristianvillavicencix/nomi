import { DashboardInvoicesCard } from "@/modules/dashboard/DashboardInvoicesCard";
import { DashboardLeadsCard } from "@/modules/dashboard/DashboardLeadsCard";
import { DashboardTicketsCard } from "@/modules/dashboard/DashboardTicketsCard";
import { DashboardWeekCalendar } from "@/modules/dashboard/DashboardWeekCalendar";
import { DashboardWelcomeHeader } from "@/modules/dashboard/DashboardWelcomeHeader";

export const DashboardHomeContent = () => (
  <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
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

    <DashboardWeekCalendar />
  </div>
);
