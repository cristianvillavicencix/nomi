import { useEffect, useMemo, useState } from "react";
import { useGetList } from "ra-core";
import type { Company } from "@/components/atomic-crm/types";

export const normalizeCompanyNameForMatch = (name: string) =>
  name.trim().toLowerCase().replace(/\s+/g, " ");

export const isExactCompanyNameMatch = (
  companyName: string,
  candidateName: string,
) =>
  normalizeCompanyNameForMatch(companyName) ===
  normalizeCompanyNameForMatch(candidateName);

export const useCompanyNameDuplicateCheck = (companyName: string) => {
  const [debouncedName, setDebouncedName] = useState(companyName.trim());

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedName(companyName.trim());
    }, 400);
    return () => window.clearTimeout(handle);
  }, [companyName]);

  const enabled = debouncedName.length >= 2;

  const { data: companies = [], isFetching } = useGetList<Company>(
    "companies",
    {
      filter: { q: debouncedName },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "name", order: "ASC" },
    },
    { enabled },
  );

  const duplicateCompany = useMemo(() => {
    if (!enabled) return null;
    return (
      companies.find((company) =>
        isExactCompanyNameMatch(debouncedName, company.name),
      ) ?? null
    );
  }, [companies, debouncedName, enabled]);

  return {
    duplicateCompany,
    isChecking: enabled && isFetching,
  };
};
