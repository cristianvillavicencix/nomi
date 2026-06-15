import { DashboardActivityLog } from "./DashboardActivityLog";
import { DashboardStepper } from "./DashboardStepper";
import { DealsChart } from "./DealsChart";
import { HotContacts } from "./HotContacts";
import { Welcome } from "./Welcome";
import { useOnboardingState } from "./useOnboardingState";
import { LbsDashboardTasks } from "@/modules/dashboard/LbsDashboardTasks";

export const Dashboard = () => {
  const { totalContact, totalContactNotes, firstContactId, isPending } =
    useOnboardingState();

  if (isPending) {
    return null;
  }

  if (!totalContact) {
    return <DashboardStepper step={1} />;
  }

  if (!totalContactNotes) {
    return <DashboardStepper step={2} contactId={firstContactId} />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mt-1">
      <div className="md:col-span-3">
        <div className="flex flex-col gap-4">
          {import.meta.env.VITE_IS_DEMO === "true" ? <Welcome /> : null}
          <HotContacts />
        </div>
      </div>
      <div className="md:col-span-6">
        <div className="flex flex-col gap-6">
          <DealsChart />
          <DashboardActivityLog />
        </div>
      </div>

      <div className="md:col-span-3">
        <LbsDashboardTasks />
      </div>
    </div>
  );
};
