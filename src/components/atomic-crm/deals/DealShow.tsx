import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const ShowFallback = () => <Skeleton className="h-96 w-full rounded-xl" />;

const LbsProjectShowPage = lazy(() =>
  import("@/lbs/projects/ProjectShowPage").then((m) => ({
    default: m.ProjectShowPage,
  })),
);

export const DealShow = ({ id }: { id?: string }) => {
  return (
    <Suspense fallback={<ShowFallback />}>
      <LbsProjectShowPage id={id} />
    </Suspense>
  );
};
