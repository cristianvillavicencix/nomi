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
import { DEFAULT_MEETING_DURATION_MINUTES } from "@/modules/calendar/calendarReminderOptions";
import { MeetingScheduleForm } from "@/modules/meetings/MeetingScheduleForm";
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dueDate?: string;
  dealId?: Identifier;
}) => {
  const { identity } = useGetIdentity();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [category, setCategory] = useState<WorkCategory>("task");
  const defaultDate = dueDate ?? new Date().toISOString().slice(0, 10);

  if (!identity) return null;

  const closeDialog = () => onOpenChange(false);

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
    notify(
      isMeetingWorkCategory(category)
        ? "Meeting scheduled"
        : "Added to calendar",
    );
  };

  const categoryHint = (() => {
    if (category === "task") {
      return "Task shows due date and priority.";
    }
    if (category === "meeting") {
      return "Meeting uses start time and duration.";
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
          assignee_person_ids: [],
          collaborator_person_ids: [],
          priority: "normal",
          internal: false,
        }}
        transform={(data) => {
          const normalized = normalizeTaskCreateData({
            ...data,
            deal_id: dealId ?? data.deal_id ?? null,
          });
          const assigneeId = Number(data.organization_member_id);
          if (
            Number.isFinite(assigneeId) &&
            (normalized.assignee_person_ids?.length ?? 0) === 0
          ) {
            normalized.assignee_person_ids = [assigneeId];
          }
          return normalized;
        }}
        mutationOptions={{ onSuccess: handleTaskSuccess }}
      >
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="top-1/20 max-h-9/10 translate-y-0 overflow-y-auto lg:max-w-xl">
            <Form className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>Add to Calendar</DialogTitle>
              </DialogHeader>
              <WorkCreateCategoryPicker
                value={category}
                onChange={setCategory}
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

  if (isMeetingWorkCategory(category)) {
    return (
      <CreateBase
        key={`meeting-${defaultDate}`}
        resource="calendar_events"
        record={{
          title: "",
          event_date: defaultDate,
          event_time: null,
          duration_minutes: DEFAULT_MEETING_DURATION_MINUTES,
          remind_before_minutes: 15,
          description: "",
          meeting_url: null,
          contact_id: null,
          deal_id: dealId ?? null,
          organization_member_id: identity.id,
          completed_at: null,
        }}
        transform={prepareCalendarEventWriteData}
        mutationMode="pessimistic"
        mutationOptions={{ onSuccess: handleEventSuccess }}
      >
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="top-1/20 max-h-9/10 translate-y-0 overflow-y-auto lg:max-w-xl">
            <div className="mb-4">
              <DialogHeader className="mb-4">
                <DialogTitle>Add to Calendar</DialogTitle>
              </DialogHeader>
              <WorkCreateCategoryPicker
                value={category}
                onChange={setCategory}
              />
            </div>
            <MeetingScheduleForm isEdit={false} />
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
        remind_before_minutes: category === "follow_up" ? 15 : null,
        description: "",
        contact_id: null,
        deal_id: dealId ?? null,
        organization_member_id: identity.id,
        completed_at: null,
      }}
      transform={prepareCalendarEventWriteData}
      mutationMode="pessimistic"
      mutationOptions={{ onSuccess: handleEventSuccess }}
    >
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="top-1/20 max-h-9/10 translate-y-0 overflow-y-auto lg:max-w-xl">
          <Form className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Add to Calendar</DialogTitle>
            </DialogHeader>
            <WorkCreateCategoryPicker value={category} onChange={setCategory} />
            <WorkCreateEventFields category={category} />
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
