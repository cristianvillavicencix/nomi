import { useEffect, useMemo, useState } from "react";
import { useGetList } from "ra-core";

import type { Deal } from "@/components/atomic-crm/types";

export const STAGE_DEALS_PAGE_SIZE = 30;

export const useStageDeals = (
  stage: string,
  pipelineId: string,
  baseFilter: Record<string, unknown>,
) => {
  const [pagesLoaded, setPagesLoaded] = useState(1);

  useEffect(() => {
    setPagesLoaded(1);
  }, [stage, pipelineId, baseFilter]);

  const filter = useMemo(
    () => ({
      ...baseFilter,
      stage,
      pipeline_id: pipelineId,
    }),
    [baseFilter, pipelineId, stage],
  );

  const { data, total, isPending, isFetching, refetch } = useGetList<Deal>(
    "deals",
    {
      filter,
      pagination: { page: 1, perPage: pagesLoaded * STAGE_DEALS_PAGE_SIZE },
      sort: { field: "index", order: "DESC" },
    },
  );

  const deals = data ?? [];
  const totalCount = total ?? deals.length;
  const hasMore = totalCount > deals.length;

  return {
    deals,
    total: totalCount,
    hasMore,
    isPending,
    isFetching,
    loadMore: () => setPagesLoaded((page) => page + 1),
    refetch,
  };
};
