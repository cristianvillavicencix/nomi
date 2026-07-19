import { useTimeout } from "ra-core";
import { Skeleton } from "@/components/ui/skeleton";

import { DashboardStepper } from "./DashboardStepper";
import { useOnboardingState } from "./useOnboardingState";
import { DashboardHomeContent } from "@/modules/dashboard/DashboardHomeContent";
import MobileHeader from "../layout/MobileHeader";
import { MobileContent } from "../layout/MobileContent";
import { BrandWordmark } from "../layout/BrandWordmark";
import { useConfigurationContext } from "../root/ConfigurationContext";

const Wrapper = ({ children }: { children: React.ReactNode }) => {
  const { darkModeLogo, lightModeLogo, title } = useConfigurationContext();
  return (
    <>
      <MobileHeader>
        <div className="flex items-center gap-2 text-secondary-foreground no-underline py-3">
          <img
            className="[.light_&]:hidden h-6 w-6 rounded-sm object-cover"
            src={darkModeLogo}
            alt={title}
          />
          <img
            className="[.dark_&]:hidden h-6 w-6 rounded-sm object-cover"
            src={lightModeLogo}
            alt={title}
          />
          <BrandWordmark title={title} titleClassName="text-xl" />
        </div>
      </MobileHeader>
      <MobileContent>{children}</MobileContent>
    </>
  );
};

const Loading = () => (
  <Wrapper>
    <Skeleton className="h-4 w-3/4 mb-4" />
    <Skeleton className="h-4 w-full mb-2" />
    <Skeleton className="h-4 w-full mb-2" />
    <Skeleton className="h-4 w-full mb-2" />
    <Skeleton className="h-4 w-full mb-2" />
  </Wrapper>
);

export const MobileDashboard = () => {
  const { totalContact, totalContactNotes, firstContactId, isPending } =
    useOnboardingState();
  const oneSecondHasPassed = useTimeout(1000);

  if (isPending) {
    return oneSecondHasPassed ? <Loading /> : null;
  }

  if (!totalContact) {
    return (
      <Wrapper>
        <DashboardStepper step={1} />
      </Wrapper>
    );
  }

  if (!totalContactNotes) {
    return (
      <Wrapper>
        <DashboardStepper step={2} contactId={firstContactId} />
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      <DashboardHomeContent />
    </Wrapper>
  );
};
