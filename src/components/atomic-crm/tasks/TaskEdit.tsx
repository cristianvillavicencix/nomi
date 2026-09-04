import { EditBase, Form, useNotify, type Identifier } from "ra-core";
import { DeleteButton } from "@/components/admin/delete-button";
import { DialogSaveButton } from "@/components/admin/form-guard";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { normalizeTaskCreateData } from "@/components/atomic-crm/tasks/taskConstants";

import { TaskFormContent } from "./TaskFormContent";

export const TaskEdit = ({
  open,
  close,
  onOpenChange,
  taskId,
}: {
  taskId: Identifier;
  open: boolean;
  /** @deprecated Prefer onOpenChange */
  close?: () => void;
  onOpenChange?: (open: boolean) => void;
}) => {
  const notify = useNotify();

  const handleOpenChange = (next: boolean) => {
    onOpenChange?.(next);
    if (!next) close?.();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {taskId ? (
        <EditBase
          id={taskId}
          resource="tasks"
          className="mt-0"
          transform={normalizeTaskCreateData}
          mutationOptions={{
            onSuccess: () => {
              handleOpenChange(false);
              notify("Task updated", {
                type: "info",
                undoable: true,
              });
            },
          }}
          redirect={false}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto lg:max-w-xl">
            <Form className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>Edit task</DialogTitle>
              </DialogHeader>
              <TaskFormContent showAccountLink={false} />
              <DialogFooter className="w-full gap-4 sm:justify-between">
                <DeleteButton
                  mutationOptions={{
                    onSuccess: () => {
                      handleOpenChange(false);
                      notify("Task deleted", {
                        type: "info",
                        undoable: true,
                      });
                    },
                  }}
                  redirect={false}
                />
                <DialogSaveButton label="Save" />
              </DialogFooter>
            </Form>
          </DialogContent>
        </EditBase>
      ) : null}
    </Dialog>
  );
};
