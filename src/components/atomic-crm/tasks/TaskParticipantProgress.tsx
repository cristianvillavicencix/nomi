import { Badge } from "@/components/ui/badge";
import { getTaskParticipantProgress } from "@/components/atomic-crm/tasks/taskParticipants";
import type { TaskParticipant } from "@/components/atomic-crm/types";

export const TaskParticipantProgress = ({
  participants,
}: {
  participants: TaskParticipant[];
}) => {
  if (participants.length <= 1) return null;

  const { completed, total } = getTaskParticipantProgress(participants);
  const allDone = completed === total;

  return (
    <Badge
      variant="outline"
      className={
        allDone
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-amber-200 bg-amber-50 text-amber-900"
      }
    >
      {completed}/{total} done
    </Badge>
  );
};
