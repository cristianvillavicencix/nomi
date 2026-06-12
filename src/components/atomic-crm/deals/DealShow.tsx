import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { isValidRecordId } from "@/lib/isValidRecordId";

const ShowFallback = () => <Skeleton className="h-96 w-full rounded-xl" />;

const LbsProjectShowPage = lazy(() =>
  import("@/modules/deals/projects/ProjectShowPage").then((m) => ({
    default: m.ProjectShowPage,
  })),
);

export const DealShow = ({ id }: { id?: string }) => {
  if (!isValidRecordId(id)) return null;

  return (
    <Suspense fallback={<ShowFallback />}>
      <LbsProjectShowPage id={id} />
    </Suspense>
  );
};
