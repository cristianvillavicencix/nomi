import { Plus } from "lucide-react";
import {
  CreateBase,
  Form,
  useDataProvider,
  useGetIdentity,
  useNotify,
  useRecordContext,
  useUpdate,
  type Identifier,
} from "ra-core";
import { useState } from "react";
import { DialogSaveButton } from "@/components/admin/form-guard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { TaskFormContent } from "./TaskFormContent";
import { normalizeTaskCreateData } from "./taskConstants";

export const AddTask = ({
  display = "chip",
  contactId,
  contactIds,
  dealId,
  dueDate,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  hideTrigger = false,
}: {
  selectContact?: boolean;
  display?: "chip" | "icon";
  contactId?: Identifier;
  contactIds?: Identifier[];
  dealId?: Identifier;
  contactFilter?: Record<string, string>;
  dueDate?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) => {
  const { identity } = useGetIdentity();
  const dataProvider = useDataProvider();
  const [update] = useUpdate();
  const notify = useNotify();
  const contact = useRecordContext();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const defaultDueDate = dueDate ?? new Date().toISOString().slice(0, 10);
  const resolvedContactId =
    contactId ??
    (contactIds?.length === 1 ? contactIds[0] : undefined) ??
    contact?.id;

  const handleSuccess = async (data: any) => {
    setOpen(false);
    if (!data?.contact_id) {
      notify("Task added");
      return;
    }
    const contactRecord = await dataProvider.getOne("contacts", {
      id: data.contact_id,
    });
    if (!contactRecord.data) return;

    await update("contacts", {
      id: contactRecord.data.id,
      data: { last_seen: new Date().toISOString() },
      previousData: contactRecord.data,
    });

    notify("Task added");
  };

  if (!identity) return null;

  return (
    <>
      {!hideTrigger ? (
        display === "icon" ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="p-2 cursor-pointer"
                  onClick={() => setOpen(true)}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Create task</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <div className="my-2">
            <Button
              variant="outline"
              className="h-6 cursor-pointer"
              onClick={() => setOpen(true)}
              size="sm"
            >
              <Plus className="w-4 h-4" />
              Add task
            </Button>
          </div>
        )
      ) : null}

      {open ? (
        <CreateBase
          key={defaultDueDate}
          resource="tasks"
          record={{
            type: "none",
            ...(resolvedContactId != null
              ? { contact_id: resolvedContactId }
              : {}),
            deal_id: dealId ?? null,
            due_date: defaultDueDate,
            organization_member_id: identity.id,
            assignee_person_ids: [],
            collaborator_person_ids: [],
            priority: "normal",
            internal: false,
          }}
          transform={(data) =>
            normalizeTaskCreateData({
              ...data,
              deal_id: dealId ?? data.deal_id ?? null,
            })
          }
          mutationOptions={{ onSuccess: handleSuccess }}
        >
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="lg:max-w-xl overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
              <Form className="flex flex-col gap-4">
                <DialogHeader>
                  <DialogTitle>New task</DialogTitle>
                </DialogHeader>
                <TaskFormContent defaultDealId={dealId} />
                <DialogFooter className="w-full justify-end">
                  <DialogSaveButton />
                </DialogFooter>
              </Form>
            </DialogContent>
          </Dialog>
        </CreateBase>
      ) : null}
    </>
  );
};
