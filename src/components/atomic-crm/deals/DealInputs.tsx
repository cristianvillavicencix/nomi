import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { LbsDealInputs } from "@/lbs/deals/LbsDealInputs";

const InputsFallback = () => (
  <div className="space-y-4">
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-24 w-full" />
  </div>
);

const isContractorBuild =
  import.meta.env.VITE_PRODUCT_MODE === "contractor";

const ContractorDealInputsForm = isContractorBuild
  ? lazy(() =>
      import("./DealInputsContractor").then((m) => ({
        default: m.ContractorDealInputsForm,
      })),
    )
  : null;

/** Deal create/edit fields — LBS agency vs contractor (build-specific lazy chunk). */
export const DealInputs = () => {
  if (isContractorBuild && ContractorDealInputsForm) {
    return (
      <Suspense fallback={<InputsFallback />}>
        <ContractorDealInputsForm />
      </Suspense>
    );
  }

  return <LbsDealInputs />;
};
