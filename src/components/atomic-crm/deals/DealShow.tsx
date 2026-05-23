import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const ShowFallback = () => <Skeleton className="h-96 w-full rounded-xl" />;

const LbsProjectShowPage = lazy(() =>
  import("@/lbs/projects/ProjectShowPage").then((m) => ({
    default: m.ProjectShowPage,
  })),
);

const isContractorBuild =
  import.meta.env.VITE_PRODUCT_MODE === "contractor";

const ContractorDealShow = isContractorBuild
  ? lazy(() =>
      import("@/contractor/deals/ContractorDealShow").then((m) => ({
        default: m.ContractorDealShow,
      })),
    )
  : null;

/** Routes LBS agency projects vs contractor deal show (build-specific lazy chunk). */
export const DealShow = ({ id }: { id?: string }) => {
  if (isContractorBuild && ContractorDealShow) {
    return (
      <Suspense fallback={<ShowFallback />}>
        <ContractorDealShow id={id} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<ShowFallback />}>
      <LbsProjectShowPage id={id} />
    </Suspense>
  );
};
