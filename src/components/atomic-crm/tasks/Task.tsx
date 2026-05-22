import { useMemo, useState } from "react";
import { Link } from "react-router";
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
import { OrganizationMemberName } from "@/components/atomic-crm/organizationMembers/OrganizationMemberName";
import { TaskAssignedAvatars } from "@/components/atomic-crm/tasks/TaskAssignedAvatars";
import {
  getTaskPriorityClassName,
  getTaskPriorityLabel,
} from "@/components/atomic-crm/tasks/taskConstants";
import { TaskMentionText } from "@/components/atomic-crm/tasks/TaskMentionText";
import { TaskParticipantProgress } from "@/components/atomic-crm/tasks/TaskParticipantProgress";
import { useTaskCompletionToggle } from "@/components/atomic-crm/tasks/useTaskCompletionToggle";
import { useTaskParticipantsByTaskIds } from "@/components/atomic-crm/tasks/useTaskParticipants";
import { useConfigurationContext } from "../root/ConfigurationContext";
import {
  useDeleteWithUndoController,
  useNotify,
  useUpdate,
} from "ra-core";
import { MoreVertical } from "lucide-react";
import type { Contact, Deal, Task as TData } from "../types";
import { TaskEditSheet } from "./TaskEditSheet";
import { TaskEdit } from "./TaskEdit";
import { useIsMobile } from "@/hooks/use-mobile";
import { isLbsMode } from "@/lbs/productMode";

export const Task = ({
  task,
  showContact,
  showDeal,
  showAssignee,
}: {
  task: TData;
  showContact?: boolean;
  showDeal?: boolean;
  showAssignee?: boolean;
}) => {
  const isMobile = useIsMobile();
  const { taskTypes } = useConfigurationContext();
  const notify = useNotify();
  const taskIds = useMemo(() => [task.id], [task.id]);
  const { participantsByTaskId } = useTaskParticipantsByTaskIds(taskIds);
  const participants = participantsByTaskId[String(task.id)] ?? [];
  const {
    toggle,
    checkboxChecked,
    checkboxDisabled,
    requiresAllParticipants,
    isPending: isCompletionPending,
  } = useTaskCompletionToggle(task, participants);

  const [openEdit, setOpenEdit] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isFullyDone = Boolean(task.done_date);

  const handleCloseEdit = () => {
    setOpenEdit(false);
  };

  const [update, { isPending: isUpdatePending }] = useUpdate();
  const { handleDelete } = useDeleteWithUndoController({
    record: task,
    redirect: false,
    mutationOptions: {
      onSuccess() {
        notify("Task deleted successfully", { undoable: true });
        setDeleteOpen(false);
      },
    },
  });

  const handleEdit = () => {
    setOpenEdit(true);
  };

  const labelId = `checkbox-list-label-${task.id}`;
  const typeLabel =
    taskTypes.find((entry) => entry.value === task.type)?.label ?? task.type;

  return (
    <>
      <div className="flex items-start justify-between">
        <div
          className="flex items-start gap-2 flex-1"
          onClick={isMobile ? toggle : undefined}
        >
          <Checkbox
            id={labelId}
            checked={checkboxChecked}
            onCheckedChange={toggle}
            disabled={checkboxDisabled || isCompletionPending}
            className="mt-1"
          />
          <div className={`flex-grow ${isFullyDone ? "line-through" : ""}`}>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {task.type && task.type !== "none" ? (
                <span className="font-semibold">{typeLabel}</span>
              ) : null}
              {task.internal ? (
                <Badge variant="secondary" className="text-[10px] uppercase">
                  Internal
                </Badge>
              ) : null}
              {task.priority && task.priority !== "normal" ? (
                <Badge
                  variant="outline"
                  className={getTaskPriorityClassName(task.priority)}
                >
                  {getTaskPriorityLabel(task.priority)}
                </Badge>
              ) : null}
            </div>
            <div className="text-sm">
              {isLbsMode() ? <TaskMentionText text={task.text} /> : task.text}
            </div>
            {requiresAllParticipants ? (
              <div className="mt-1">
                <TaskParticipantProgress participants={participants} />
              </div>
            ) : null}
            <div className="text-sm text-muted-foreground">
              due&nbsp;
              <DateField source="due_date" record={task} />
              {showAssignee ? (
                <>
                  {" · "}
                  {isLbsMode() &&
                  ((task.assignee_person_ids?.length ?? 0) > 0 ||
                    (task.collaborator_person_ids?.length ?? 0) > 0 ||
                    (task.mentioned_member_ids?.length ?? 0) > 0) ? (
                    <span className="inline-flex align-middle">
                      <TaskAssignedAvatars task={task} />
                    </span>
                  ) : (
                    <ReferenceField
                      source="organization_member_id"
                      reference="organization_members"
                      record={task}
                      render={({ referenceRecord }) => (
                        <OrganizationMemberName member={referenceRecord ?? undefined} />
                      )}
                    />
                  )}
                </>
              ) : null}
              {showDeal && task.deal_id ? (
                <>
                  {" · "}
                  <ReferenceField<TData, Deal>
                    source="deal_id"
                    reference="deals"
                    record={task}
                    render={({ referenceRecord }) =>
                      referenceRecord ? (
                        <Link
                          to={`/deals/${referenceRecord.id}/show?tab=tasks`}
                          className="link-action"
                        >
                          {referenceRecord.name}
                        </Link>
                      ) : null
                    }
                  />
                </>
              ) : null}
              {showContact ? (
                <ReferenceField<TData, Contact>
                  source="contact_id"
                  reference="contacts"
                  record={task}
                  link="show"
                  className="inline text-sm text-muted-foreground"
                  render={({ referenceRecord }) => {
                    if (!referenceRecord) return null;
                    return (
                      <>
                        {" "}
                        (Re:&nbsp;
                        {referenceRecord.first_name} {referenceRecord.last_name})
                      </>
                    );
                  }}
                />
              ) : null}
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 pr-0! size-8 cursor-pointer"
              aria-label="task actions"
            >
              <MoreVertical className="size-5 md:size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="cursor-pointer h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
              onClick={() => {
                update("tasks", {
                  id: task.id,
                  data: {
                    due_date: new Date(Date.now() + 24 * 60 * 60 * 1000)
                      .toISOString()
                      .slice(0, 10),
                  },
                  previousData: task,
                });
              }}
            >
              Postpone to tomorrow
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
              onClick={() => {
                update("tasks", {
                  id: task.id,
                  data: {
                    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                      .toISOString()
                      .slice(0, 10),
                  },
                  previousData: task,
                });
              }}
            >
              Postpone to next week
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
              onClick={handleEdit}
            >
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
              onClick={() => setDeleteOpen(true)}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isMobile ? (
        <TaskEditSheet
          taskId={task.id}
          open={openEdit}
          onOpenChange={setOpenEdit}
        />
      ) : (
        <TaskEdit taskId={task.id} open={openEdit} close={handleCloseEdit} />
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
            <Button type="button" variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
