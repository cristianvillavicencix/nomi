import { useMemo } from "react";
import { useGetList } from "ra-core";
import type { ServicePackage } from "@/modules/types";

export const useAllServicePackages = () => {
  const { data: packages = [], isPending } = useGetList<ServicePackage>(
    "service_packages",
    {
      pagination: { page: 1, perPage: 200 },
      sort: { field: "sort_order", order: "ASC" },
    },
  );

  const packagesById = useMemo(() => {
    const map = new Map<string, ServicePackage>();
    for (const pkg of packages) {
      map.set(String(pkg.id), pkg);
    }
    return map;
  }, [packages]);

  return { packages, packagesById, isPending };
};
