import { QueryClient } from "@tanstack/react-query";

const RESOURCE_INVALIDATION_MAP: Record<string, string[]> = {
  contacts: ["contacts", "contacts_summary"],
  companies: ["companies", "companies_summary"],
  tasks: ["tasks", "scopedTasks", "task_participants", "task_tag_notifications"],
  task_participants: ["task_participants", "scopedTasks", "tasks"],
  task_tag_notifications: ["task_tag_notifications", "tasks"],
  deals: ["deals", "scopedTasks", "myProjectDealIds"],
  organization_members: ["organization_members"],
  conversations: ["conversations"],
  conversation_messages: ["conversations", "conversation_messages"],
};

export const createCrmQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        networkMode: "online",
      },
      mutations: {
        networkMode: "online",
      },
    },
  });

export const invalidateQueriesForResource = async (
  queryClient: QueryClient,
  resource: string,
) => {
  const keys = RESOURCE_INVALIDATION_MAP[resource] ?? [resource];

  await Promise.all(
    keys.map((queryKey) =>
      queryClient.invalidateQueries({
        queryKey: [queryKey],
        refetchType: "active",
      }),
    ),
  );
};
