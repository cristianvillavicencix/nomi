import { useQueryClient } from "@tanstack/react-query";
import { useDataProvider, useNotify, useUpdate, type Identifier } from "ra-core";
import type { Task, TaskParticipant } from "@/components/atomic-crm/types";
import {
  findCurrentUserParticipant,
  recomputeTaskDoneDate,
  taskRequiresAllParticipantsComplete,
  toggleTaskParticipantCompletion,
} from "@/components/atomic-crm/tasks/taskParticipants";
import { useCurrentMemberPerson } from "@/components/atomic-crm/tasks/useCurrentMemberPerson";

export const useTaskCompletionToggle = (
  task: Task,
  participants: TaskParticipant[] = [],
) => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [update, { isPending }] = useUpdate();
  const { identity, personId } = useCurrentMemberPerson();

  const requiresAllParticipants = taskRequiresAllParticipantsComplete(task);
  const currentParticipant =
    requiresAllParticipants && participants.length > 0
      ? findCurrentUserParticipant(participants, personId, identity?.id)
      : undefined;
  const isDone = Boolean(task.done_date);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    await queryClient.invalidateQueries({ queryKey: ["task_participants"] });
  };

  const toggle = async () => {
    try {
      if (requiresAllParticipants && participants.length > 0) {
        if (!currentParticipant) {
          notify("Only tagged people can mark their part on this task.", {
            type: "warning",
          });
          return;
        }

        await toggleTaskParticipantCompletion(
          dataProvider,
          task,
          currentParticipant,
          participants,
        );
        await invalidate();
        return;
      }

      await update(
        "tasks",
        {
          id: task.id,
          data: {
            done_date: isDone ? null : new Date().toISOString(),
          },
          previousData: task,
        },
        { returnPromise: true },
      );
      await invalidate();
    } catch {
      notify("Failed to update task", { type: "error" });
    }
  };

  const checkboxChecked = requiresAllParticipants
    ? Boolean(currentParticipant?.completed_at)
    : isDone;

  const checkboxDisabled =
    isPending ||
    (requiresAllParticipants && participants.length > 0 && !currentParticipant);

  return {
    toggle,
    checkboxChecked,
    checkboxDisabled,
    requiresAllParticipants,
    currentParticipant,
    isPending,
  };
};

export const useMarkAllParticipantsComplete = (
  task: Task,
  participants: TaskParticipant[],
) => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [update, { isPending }] = useUpdate();

  const markAllComplete = async () => {
    try {
      const now = new Date().toISOString();
      await Promise.all(
        participants
          .filter((entry) => !entry.completed_at)
          .map((entry) =>
            update(
              "task_participants",
              {
                id: entry.id,
                data: { completed_at: now },
                previousData: entry,
              },
              { returnPromise: true },
            ),
          ),
      );

      const completedParticipants = participants.map((entry) => ({
        ...entry,
        completed_at: entry.completed_at ?? now,
      }));

      await recomputeTaskDoneDate(dataProvider, task, completedParticipants);
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["task_participants"] });
    } catch {
      notify("Failed to mark task complete", { type: "error" });
    }
  };

  return { markAllComplete, isPending };
};
