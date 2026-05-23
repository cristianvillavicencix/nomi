import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { isLbsMode } from "@/lbs/productMode";

const ProjectShowPage = lazy(() =>
  import("@/lbs/projects/ProjectShowPage").then((m) => ({ default: m.ProjectShowPage })),
);

const ContractorDealShow = lazy(() =>
  import("@/contractor/deals/ContractorDealShow").then((m) => ({
    default: m.ContractorDealShow,
  })),
);

const ShowFallback = () => <Skeleton className="h-96 w-full rounded-xl" />;

/** Routes LBS agency projects vs contractor deal show (lazy-loaded). */
export const DealShow = ({ id }: { id?: string }) => (
  <Suspense fallback={<ShowFallback />}>
    {isLbsMode() ? <ProjectShowPage id={id} /> : <ContractorDealShow id={id} />}
  </Suspense>
);
