import type { QueryClient } from "@tanstack/react-query";
import { invalidateQueriesForResource } from "@/lib/queryCache";

let crmQueryClient: QueryClient | null = null;

export const registerCrmQueryClient = (queryClient: QueryClient | null) => {
  crmQueryClient = queryClient;
};

export const invalidateResourceQueries = async (resource: string) => {
  if (!crmQueryClient) return;
  await invalidateQueriesForResource(crmQueryClient, resource);
};
