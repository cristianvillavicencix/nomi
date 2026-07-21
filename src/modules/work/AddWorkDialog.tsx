import { useState } from "react";
import {
  CreateBase,
  Form,
  useDataProvider,
  useGetIdentity,
  useNotify,
  useRefresh,
  type Identifier,
} from "ra-core";
import { DialogSaveButton } from "@/components/admin/form-guard";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { normalizeTaskCreateData } from "@/components/atomic-crm/tasks/taskConstants";
import { prepareCalendarEventWriteData } from "@/modules/calendar/calendarEventWriteData";
import {
  isMeetingWorkCategory,
  isTaskWorkCategory,
  WorkCreateCategoryPicker,
} from "@/modules/work/WorkCreateCategoryPicker";
import {
  WorkCreateEventFields,
  WorkCreateTaskFields,
} from "@/modules/work/WorkCreateFormFields";
import type { WorkCategory } from "@/modules/work/workTypes";

export const AddWorkDialog = ({
  open,
  onOpenChange,
  dueDate,
  dealId,
  onScheduleMeeting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dueDate?: string;
  dealId?: Identifier;
  /** Use the shared Schedule meeting dialog instead of a second form. */
  onScheduleMeeting?: (dateKey: string) => void;
}) => {
  const { identity } = useGetIdentity();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [category, setCategory] = useState<WorkCategory>("task");
  const defaultDate = dueDate ?? new Date().toISOString().slice(0, 10);

  if (!identity) return null;

  const closeDialog = () => {
    setCategory("task");
    onOpenChange(false);
  };

  const handleCategoryChange = (next: WorkCategory) => {
    if (isMeetingWorkCategory(next) && onScheduleMeeting) {
      const dateKey = defaultDate;
      setCategory("task");
      onOpenChange(false);
      onScheduleMeeting(dateKey);
      return;
    }
    setCategory(next);
  };

  const handleTaskSuccess = async (data: Record<string, unknown>) => {
    closeDialog();
    refresh();
    if (data?.contact_id) {
      const contactRecord = await dataProvider.getOne("contacts", {
        id: data.contact_id as Identifier,
      });
      if (contactRecord.data) {
        await dataProvider.update("contacts", {
          id: contactRecord.data.id,
          data: { last_seen: new Date().toISOString() },
          previousData: contactRecord.data,
        });
      }
    }
    notify("Added to calendar");
  };

  const handleEventSuccess = () => {
    closeDialog();
    refresh();
    notify("Added to calendar");
  };

  const categoryHint = (() => {
    if (category === "task") {
      return "Task shows due date and priority.";
    }
    if (category === "meeting") {
      return "Meeting opens the shared schedule form.";
    }
    if (category === "delivery") {
      return "Delivery uses date only — no time or priority.";
    }
    if (category === "activity") {
      return "Activity can be linked to a contact or project.";
    }
    return "Follow up uses a due date and optional time.";
  })();

  if (!open) return null;

  if (isMeetingWorkCategory(category) && onScheduleMeeting) {
    return null;
  }

  if (isTaskWorkCategory(category)) {
    return (
      <CreateBase
        key={`task-${category}-${defaultDate}`}
        resource="tasks"
        record={{
          type: "none",
          deal_id: dealId ?? null,
          due_date: defaultDate,
          organization_member_id: identity.id,
          assignee_person_ids: [identity.id],
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
        mutationOptions={{ onSuccess: handleTaskSuccess }}
      >
        <Dialog
          open={open}
          onOpenChange={(next) => {
            if (!next) closeDialog();
            else onOpenChange(next);
          }}
        >
          <DialogContent className="top-1/20 max-h-9/10 translate-y-0 overflow-y-auto lg:max-w-xl">
            <Form className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>Add to Calendar</DialogTitle>
              </DialogHeader>
              <WorkCreateCategoryPicker
                value={category}
                onChange={handleCategoryChange}
              />
              <WorkCreateTaskFields
                category={category}
                defaultDealId={dealId}
              />
              <p className="rounded-sm border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                {categoryHint}
              </p>
              <DialogFooter className="w-full justify-end gap-2">
                <DialogSaveButton label="Create" />
              </DialogFooter>
            </Form>
          </DialogContent>
        </Dialog>
      </CreateBase>
    );
  }

  return (
    <CreateBase
      key={`event-${category}-${defaultDate}`}
      resource="calendar_events"
      record={{
        title: "",
        event_date: defaultDate,
        event_time: null,
        duration_minutes: null,
        reminder_offsets_minutes:
          category === "follow_up" ? [15] : [],
        remind_before_minutes: category === "follow_up" ? 15 : null,
        description: "",
        contact_id: null,
        deal_id: dealId ?? null,
        organization_member_id: identity.id,
        assignee_member_ids: [identity.id],
        completed_at: null,
      }}
      transform={prepareCalendarEventWriteData}
      mutationMode="pessimistic"
      mutationOptions={{ onSuccess: handleEventSuccess }}
    >
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) closeDialog();
          else onOpenChange(next);
        }}
      >
        <DialogContent className="top-1/20 max-h-9/10 translate-y-0 overflow-y-auto lg:max-w-xl">
          <Form className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Add to Calendar</DialogTitle>
            </DialogHeader>
            <WorkCreateCategoryPicker
              value={category}
              onChange={handleCategoryChange}
            />
            <WorkCreateEventFields category={category} />
            {category === "follow_up" ? (
              <p className="text-xs text-muted-foreground">
                Default reminder: 15 minutes before.
              </p>
            ) : null}
            <p className="rounded-sm border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
              {categoryHint}
            </p>
            <DialogFooter className="w-full justify-end gap-2">
              <DialogSaveButton label="Create" />
            </DialogFooter>
          </Form>
        </DialogContent>
      </Dialog>
    </CreateBase>
  );
};
