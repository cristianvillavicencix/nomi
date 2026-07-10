import { useQuery } from "@tanstack/react-query";
import { useDataProvider } from "ra-core";

import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { HostingerDomain } from "@/modules/hostinger/types";

export const HOSTINGER_DOMAINS_LIST_KEY = ["hostinger_domains", "list"] as const;

export const useHostingerDomains = (options?: { enabled?: boolean }) => {
  const dataProvider = useDataProvider<CrmDataProvider>();

  return useQuery({
    queryKey: HOSTINGER_DOMAINS_LIST_KEY,
    queryFn: async () => {
      const response = await dataProvider.getList<HostingerDomain>(
        "hostinger_domains",
        {
          pagination: { page: 1, perPage: 500 },
          sort: { field: "expires_at", order: "ASC" },
          filter: {},
        },
      );
      return response.data;
    },
    enabled: options?.enabled !== false,
    staleTime: 60_000,
  });
};

export const useHostingerCompanyDomains = (
  companyId?: number | string | null,
  options?: { enabled?: boolean },
) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const enabled = options?.enabled !== false && companyId != null;

  return useQuery({
    queryKey: [...HOSTINGER_DOMAINS_LIST_KEY, "company", companyId],
    queryFn: async () => {
      const response = await dataProvider.getList<HostingerDomain>(
        "hostinger_domains",
        {
          pagination: { page: 1, perPage: 100 },
          sort: { field: "expires_at", order: "ASC" },
          filter: { "company_id@eq": companyId },
        },
      );
      return response.data;
    },
    enabled,
    staleTime: 60_000,
  });
};
