import { Plus } from "lucide-react";
import {
  CreateBase,
  Form,
  RecordRepresentation,
  useDataProvider,
  useGetIdentity,
  useGetOne,
  useNotify,
  useRecordContext,
  useUpdate,
  type Identifier,
} from "ra-core";
import { useState } from "react";
import { SaveButton } from "@/components/admin/form";
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
import { isLbsMode } from "@/lbs/productMode";

export const AddTask = ({
  selectContact,
  display = "chip",
  contactId,
  contactIds,
  dealId,
  contactFilter,
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
    contactId ?? (contactIds?.length === 1 ? contactIds[0] : undefined) ?? contact?.id;
  const scopedContactFilter =
    contactIds && contactIds.length > 1
      ? { "id@in": `(${contactIds.join(",")})` }
      : contactFilter;
  const shouldSelectContact = selectContact ?? resolvedContactId == null;
  const { data: linkedContact } = useGetOne(
    "contacts",
    { id: resolvedContactId! },
    { enabled: resolvedContactId != null && !shouldSelectContact },
  );

  const handleSuccess = async (data: any) => {
    setOpen(false);
    if (!data?.contact_id) {
      notify("Task added");
      return;
    }
    const contact = await dataProvider.getOne("contacts", {
      id: data.contact_id,
    });
    if (!contact.data) return;

    await update("contacts", {
      id: contact.data.id,
      data: { last_seen: new Date().toISOString() },
      previousData: contact.data,
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
          contact_id: resolvedContactId,
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
                <DialogTitle>
                  {isLbsMode() ? "New task" : !shouldSelectContact ? "Create a new task for " : "Create a new task"}
                  {!isLbsMode() && !shouldSelectContact && (
                    <RecordRepresentation
                      record={linkedContact ?? contact}
                      resource="contacts"
                    />
                  )}
                </DialogTitle>
              </DialogHeader>
              <TaskFormContent
                selectContact={!isLbsMode() && shouldSelectContact}
                contactFilter={scopedContactFilter}
                showDealLink={!isLbsMode() && dealId == null}
                defaultDealId={dealId}
              />
              <DialogFooter className="w-full justify-end">
                <SaveButton />
              </DialogFooter>
            </Form>
          </DialogContent>
        </Dialog>
      </CreateBase>
      ) : null}
    </>
  );
};
