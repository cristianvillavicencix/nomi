import { useGetList } from "ra-core";
import type { MessageTemplate } from "@/modules/types";

export const useMessageTemplateShortcuts = (enabled = true) => {
  const { data = [], isPending, isError } = useGetList<MessageTemplate>(
    "message_templates",
    {
      pagination: { page: 1, perPage: 24 },
      sort: { field: "shortcut_sort_order", order: "ASC" },
      filter: {
        "is_archived@eq": false,
        "composer_shortcut@eq": true,
      },
    },
    { enabled },
  );

  return {
    templates: data,
    isPending,
    isError,
  };
};
