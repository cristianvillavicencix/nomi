import { DashboardStepper } from "./DashboardStepper";
import { useOnboardingState } from "./useOnboardingState";
import { DashboardHomeContent } from "@/modules/dashboard/DashboardHomeContent";

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

  return <DashboardHomeContent />;
};
