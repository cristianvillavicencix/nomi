import { useQuery } from "@tanstack/react-query";
import { useDataProvider, type Identifier } from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { GithubRepoStatus } from "@/lbs/deals/githubRepoStatus";

export const useGithubRepoStatus = (
  dealId: Identifier | undefined,
  githubRepo?: string | null,
) => {
  const dataProvider = useDataProvider<CrmDataProvider>();

  return useQuery<GithubRepoStatus>({
    queryKey: ["githubRepoStatus", dealId],
    queryFn: () => dataProvider.getGithubRepoStatus({ dealId: dealId! }),
    enabled: dealId != null && Boolean(githubRepo?.trim()),
    staleTime: 60_000,
    retry: false,
  });
};
