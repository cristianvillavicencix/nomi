import { useMemo, useState } from "react";
import {
  useDelete,
  useNotify,
} from "ra-core";
import {
  Loader2,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { ReferenceField } from "@/components/admin/reference-field";
import { DateField } from "@/components/admin/date-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type { Contact, Deal, Task as TaskRecord, TaskParticipant } from "@/components/atomic-crm/types";
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
import { TaskParticipantProgress } from "@/components/atomic-crm/tasks/TaskParticipantProgress";
import { useTaskCompletionToggle } from "@/components/atomic-crm/tasks/useTaskCompletionToggle";
import { useTaskParticipantsByTaskIds } from "@/components/atomic-crm/tasks/useTaskParticipants";
import {
  getOpenTaskAgeLabel,
  getUserCompletionDurationLabel,
} from "@/components/atomic-crm/tasks/taskTiming";
import { useIsMobile } from "@/hooks/use-mobile";
import { isLbsMode } from "@/lbs/productMode";

export const TaskTable = ({
  tasks,
  status = "open",
  showContact = false,
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
  const lbsMode = isLbsMode();
  const sortedTasks = sortTasksByPriorityAndDue(tasks);
  const taskIds = useMemo(() => sortedTasks.map((task) => task.id), [sortedTasks]);
  const { participantsByTaskId } = useTaskParticipantsByTaskIds(taskIds);

  if (sortedTasks.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  if (lbsMode) {
    return (
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Description</TableHead>
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
                variant="simple"
                status={status}
                participants={participantsByTaskId[String(task.id)] ?? []}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10" />
            <TableHead className="whitespace-nowrap">Type</TableHead>
            <TableHead>Description</TableHead>
            {showProject ? <TableHead>Project</TableHead> : null}
            {showContact ? <TableHead>Contact</TableHead> : null}
            <TableHead>Due</TableHead>
            <TableHead className="hidden md:table-cell whitespace-nowrap">
              {status === "done" ? "Completed in" : "Open for"}
            </TableHead>
            <TableHead className="hidden md:table-cell">Assigned</TableHead>
            <TableHead className="hidden lg:table-cell">Priority</TableHead>
            <TableHead className="w-[72px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedTasks.map((task) => (
            <TaskTableRow
              key={String(task.id)}
              task={task}
              showContact={showContact}
              showProject={showProject}
              isMobile={isMobile}
              variant="default"
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
  showContact = false,
  showProject = false,
  isMobile,
  variant,
  status = "open",
  participants = [],
}: {
  task: TaskRecord;
  showContact?: boolean;
  showProject?: boolean;
  isMobile: boolean;
  variant: "simple" | "default";
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
    isPending: isUpdatePending,
  } = useTaskCompletionToggle(task, participants);

  const typeLabel =
    taskTypes.find((entry) => entry.value === task.type)?.label ?? task.type;
  const isFullyDone = Boolean(task.done_date);
  const isDoneForUser = usesParticipantCompletion ? checkboxChecked : isFullyDone;
  const timingLabel =
    status === "done"
      ? getUserCompletionDurationLabel(task, currentParticipant) ??
        (isFullyDone && task.done_date
          ? getUserCompletionDurationLabel(task, {
              completed_at: task.done_date,
            } as TaskParticipant)
          : null)
      : getOpenTaskAgeLabel(task);
  const isSimple = variant === "simple";

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
      <TaskAssignedAvatars task={task} />
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

        {!isSimple ? (
          <TableCell className="max-w-[140px] whitespace-nowrap align-top">
            <div className={isDoneForUser ? "line-through" : undefined}>
              {task.type && task.type !== "none" ? (
                <Badge variant="outline">{typeLabel}</Badge>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
              {task.internal ? (
                <Badge variant="secondary" className="ml-2 text-[10px] uppercase">
                  Internal
                </Badge>
              ) : null}
            </div>
          </TableCell>
        ) : null}

        <TableCell className={isSimple ? "max-w-[360px] align-top" : "max-w-[280px] align-top"}>
          <TaskDescriptionCell
            text={task.text}
            isDone={isDoneForUser}
            useMentions={isSimple}
            footer={
              usesParticipantCompletion && participants.length > 1 ? (
                <TaskParticipantProgress participants={participants} />
              ) : null
            }
          />
        </TableCell>

        {!isSimple && showProject ? (
          <TableCell className="max-w-[180px] align-top">
            {task.deal_id ? (
              <ReferenceField<TaskRecord, Deal>
                source="deal_id"
                reference="deals"
                record={task}
                link="show"
                render={({ referenceRecord }) =>
                  referenceRecord ? (
                    <span className="truncate text-sm link-action">{referenceRecord.name}</span>
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

        {!isSimple && showContact ? (
          <TableCell className="max-w-[160px] align-top">
            <ReferenceField<TaskRecord, Contact>
              source="contact_id"
              reference="contacts"
              record={task}
              link="show"
              render={({ referenceRecord }) =>
                referenceRecord ? (
                  <span className="truncate text-sm">
                    {referenceRecord.first_name} {referenceRecord.last_name}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )
              }
            />
          </TableCell>
        ) : null}

        <TableCell className="whitespace-nowrap text-sm align-top">
          <span className={isTaskOverdue(task) ? "font-medium text-red-600" : "text-muted-foreground"}>
            <DateField source="due_date" record={task} />
          </span>
        </TableCell>

        <TableCell className="whitespace-nowrap text-sm align-top text-muted-foreground">
          {timingLabel ?? "—"}
        </TableCell>

        <TableCell
          className={`text-sm text-muted-foreground align-top ${isSimple ? "" : "hidden md:table-cell"}`}
        >
          <div className="flex flex-col gap-1">
            {assignedCell}
            {!isSimple && usesParticipantCompletion && participants.length > 1 ? (
              <TaskParticipantProgress participants={participants} />
            ) : null}
          </div>
        </TableCell>

        <TableCell className={`align-top ${isSimple ? "" : "hidden lg:table-cell"}`}>
          <Badge
            variant="outline"
            className={getTaskPriorityClassName(task.priority)}
          >
            {getTaskPriorityLabel(task.priority)}
          </Badge>
        </TableCell>

        <TableCell className="text-right align-top">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="size-8">
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                <Pencil className="size-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
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
        <TaskEditSheet
          taskId={task.id}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      ) : (
        <TaskEdit taskId={task.id} open={editOpen} close={() => setEditOpen(false)} />
      )}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete task?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently remove the task. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="size-4 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
