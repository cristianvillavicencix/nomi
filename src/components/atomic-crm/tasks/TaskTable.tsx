import { useMemo, useState } from "react";
import { useDelete, useNotify } from "ra-core";
import { Loader2, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { ReferenceField } from "@/components/admin/reference-field";
import { DateField } from "@/components/admin/date-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OrganizationMemberName } from "@/components/atomic-crm/organizationMembers/OrganizationMemberName";
import { TaskAssignedAvatars } from "@/components/atomic-crm/tasks/TaskAssignedAvatars";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import type {
  Contact,
  Deal,
  Task as TaskRecord,
  TaskParticipant,
} from "@/components/atomic-crm/types";
import { TaskEdit } from "@/components/atomic-crm/tasks/TaskEdit";
import { TaskEditSheet } from "@/components/atomic-crm/tasks/TaskEditSheet";
import {
  getTaskPriorityClassName,
  getTaskPriorityLabel,
  sortTasksByPriorityAndDue,
  type TaskStatusFilter,
} from "@/components/atomic-crm/tasks/taskConstants";
import { isTaskOverdue } from "@/components/atomic-crm/tasks/taskStats";
import { TaskDescriptionCell } from "@/components/atomic-crm/tasks/TaskDescriptionCell";
import { useTaskCompletionToggle } from "@/components/atomic-crm/tasks/useTaskCompletionToggle";
import { useTaskParticipantsByTaskIds } from "@/components/atomic-crm/tasks/useTaskParticipants";
import {
  getOpenTaskAgeLabel,
  getUserCompletionDurationLabel,
} from "@/components/atomic-crm/tasks/taskTiming";
import { useIsMobile } from "@/hooks/use-mobile";

export const TaskTable = ({
  tasks,
  status = "open",
  showProject = false,
  emptyMessage = "No tasks yet.",
}: {
  tasks: TaskRecord[];
  status?: TaskStatusFilter;
  showContact?: boolean;
  showProject?: boolean;
  emptyMessage?: string;
}) => {
  const isMobile = useIsMobile();
  const sortedTasks = sortTasksByPriorityAndDue(tasks);
  const taskIds = useMemo(
    () => sortedTasks.map((task) => task.id),
    [sortedTasks],
  );
  const { participantsByTaskId } = useTaskParticipantsByTaskIds(taskIds);

  if (sortedTasks.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10" />
            <TableHead>Description</TableHead>
            {showProject ? <TableHead>Project</TableHead> : null}
            <TableHead className="w-[120px] whitespace-nowrap">Due</TableHead>
            <TableHead className="w-[120px] whitespace-nowrap">
              {status === "done" ? "Completed in" : "Open for"}
            </TableHead>
            <TableHead className="w-[120px]">Assigned</TableHead>
            <TableHead className="w-[100px]">Priority</TableHead>
            <TableHead className="w-[72px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedTasks.map((task) => (
            <TaskTableRow
              key={String(task.id)}
              task={task}
              isMobile={isMobile}
              showProject={showProject}
              status={status}
              participants={participantsByTaskId[String(task.id)] ?? []}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

const TaskTableRow = ({
  task,
  showProject = false,
  isMobile,
  status = "open",
  participants = [],
}: {
  task: TaskRecord;
  showProject?: boolean;
  isMobile: boolean;
  status?: TaskStatusFilter;
  participants?: TaskParticipant[];
}) => {
  const { taskTypes } = useConfigurationContext();
  const notify = useNotify();
  const [deleteOne, { isPending: isDeleting }] = useDelete();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const {
    toggle,
    checkboxChecked,
    checkboxDisabled,
    usesParticipantCompletion,
    currentParticipant,
  } = useTaskCompletionToggle(task, participants);

  const typeLabel =
    taskTypes.find((entry) => entry.value === task.type)?.label ?? task.type;
  const isFullyDone = Boolean(task.done_date);
  const isDoneForUser = usesParticipantCompletion
    ? checkboxChecked
    : isFullyDone;
  const timingLabel =
    status === "done"
      ? (getUserCompletionDurationLabel(task, currentParticipant) ??
        (isFullyDone && task.done_date
          ? getUserCompletionDurationLabel(task, {
              completed_at: task.done_date,
            } as TaskParticipant)
          : null))
      : getOpenTaskAgeLabel(task);

  const handleDelete = async () => {
    try {
      await deleteOne(
        "tasks",
        { id: task.id, previousData: task },
        { returnPromise: true },
      );
      notify("Task deleted");
      setDeleteOpen(false);
    } catch {
      notify("Failed to delete task", { type: "error" });
    }
  };

  const assignedCell =
    (task.assignee_person_ids?.length ?? 0) > 0 ||
    (task.collaborator_person_ids?.length ?? 0) > 0 ||
    (task.mentioned_member_ids?.length ?? 0) > 0 ? (
      <TaskAssignedAvatars task={task} participants={participants} />
    ) : (
      <ReferenceField
        source="organization_member_id"
        reference="organization_members"
        record={task}
        render={({ referenceRecord }) => (
          <OrganizationMemberName member={referenceRecord ?? undefined} />
        )}
      />
    );

  return (
    <>
      <TableRow className={isDoneForUser ? "opacity-70" : undefined}>
        <TableCell className="align-top">
          <Checkbox
            checked={checkboxChecked}
            disabled={checkboxDisabled}
            onCheckedChange={toggle}
            aria-label={
              usesParticipantCompletion
                ? checkboxChecked
                  ? "Mark my part open"
                  : "Mark my part done"
                : isFullyDone
                  ? "Mark task open"
                  : "Mark task done"
            }
            className="mt-0.5"
          />
        </TableCell>

        <TableCell className="max-w-[360px] align-top">
          <TaskDescriptionCell
            text={task.text}
            isDone={isDoneForUser}
            useMentions
          />
        </TableCell>

        {showProject ? (
          <TableCell className="max-w-[180px] align-top">
            {task.deal_id ? (
              <ReferenceField<TaskRecord, Deal>
                source="deal_id"
                reference="deals"
                record={task}
                link="show"
                render={({ referenceRecord }) =>
                  referenceRecord ? (
                    <span className="truncate text-sm link-action">
                      {referenceRecord.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )
                }
              />
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </TableCell>
        ) : null}

        <TableCell className="whitespace-nowrap align-top">
          <DateField source="due_date" record={task} />
          {isTaskOverdue(task) && !isDoneForUser ? (
            <Badge variant="destructive" className="ml-2 text-[10px]">
              Overdue
            </Badge>
          ) : null}
        </TableCell>

        <TableCell className="whitespace-nowrap align-top text-sm text-muted-foreground">
          {timingLabel ?? "—"}
        </TableCell>

        <TableCell className="align-top">{assignedCell}</TableCell>

        <TableCell className="align-top">
          {task.priority && task.priority !== "normal" ? (
            <Badge
              variant="outline"
              className={getTaskPriorityClassName(task.priority)}
            >
              {getTaskPriorityLabel(task.priority)}
            </Badge>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </TableCell>

        <TableCell className="align-top text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton aria-label="More actions">
                <MoreVertical className="size-4" />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                <Pencil className="size-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                disabled={isDeleting}
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>

      {isMobile ? (
        <TaskEdit open={editOpen} onOpenChange={setEditOpen} taskId={task.id} />
      ) : (
        <TaskEditSheet
          open={editOpen}
          onOpenChange={setEditOpen}
          taskId={task.id}
        />
      )}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete task?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={handleDelete}
            >
              {isDeleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
