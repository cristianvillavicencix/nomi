import { DeleteButton } from "@/components/admin";
import { type Identifier, useGetOne } from "ra-core";
import { EditSheet } from "../misc/EditSheet";
import { TaskFormContent } from "./TaskFormContent";
import { ShareRecordModal } from "@/components/atomic-crm/settings/ShareRecordModal";
import type { Task } from "../types";

export interface TaskEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: Identifier;
}

const TaskEditShareButton = ({ taskId }: { taskId: Identifier }) => {
  const { data: task } = useGetOne<Task>(
    "tasks",
    { id: taskId },
    { enabled: !!taskId },
  );
  if (!task) return null;
  return (
    <ShareRecordModal
      resourceType="tasks"
      resourceId={taskId}
      orgId={(task as Task & { org_id?: number }).org_id}
      label="Share"
    />
  );
};

export const TaskEditSheet = ({
  open,
  onOpenChange,
  taskId,
}: TaskEditSheetProps) => {
  return (
    <EditSheet
      resource="tasks"
      id={taskId}
      title={
        <div className="flex items-center justify-between gap-2 pr-10">
          <h1 className="truncate text-xl font-semibold">Edit task</h1>
          <TaskEditShareButton taskId={taskId} />
        </div>
      }
      redirect={false}
      open={open}
      onOpenChange={onOpenChange}
      deleteButton={
        <DeleteButton
          variant="destructive"
          className="flex-1"
          redirect={false}
          onClick={() => {
            onOpenChange(false);
          }}
        />
      }
    >
      <TaskFormContent showDealLink={false} />
    </EditSheet>
  );
};
