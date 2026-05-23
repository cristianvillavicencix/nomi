import { useMemo } from "react";
import { useGetList, type Identifier } from "ra-core";
import type { Task, TaskParticipant } from "@/components/atomic-crm/types";

export const useTaskParticipantsByTaskIds = (taskIds: Identifier[]) => {
  const normalizedTaskIds = useMemo(
    () => Array.from(new Set(taskIds.map(String).filter(Boolean))),
    [taskIds],
  );

  const { data: participants = [], isPending } = useGetList<TaskParticipant>(
    "task_participants",
    {
      filter:
        normalizedTaskIds.length > 0
          ? { "task_id@in": `(${normalizedTaskIds.join(",")})` }
          : { "task_id@eq": -1 },
      pagination: {
        page: 1,
        perPage: Math.max(normalizedTaskIds.length * 10, 1),
      },
      sort: { field: "id", order: "ASC" },
    },
    { enabled: normalizedTaskIds.length > 0, staleTime: 5_000 },
  );

  const participantsByTaskId = useMemo(() => {
    const grouped: Record<string, TaskParticipant[]> = {};
    participants.forEach((participant) => {
      const key = String(participant.task_id);
      grouped[key] = grouped[key]
        ? [...grouped[key], participant]
        : [participant];
    });
    return grouped;
  }, [participants]);

  return { participantsByTaskId, isPending };
};
