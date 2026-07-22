import type { Identifier } from "ra-core";
import { CreateBase, Form, type MutationMode } from "ra-core";
import { DialogSaveButton } from "@/components/admin/form-guard";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { normalizeTaskCreateData } from "@/components/atomic-crm/tasks/taskConstants";
import { CalendarEventFormInitializer } from "@/modules/calendar/CalendarEventFormInitializer";
import {
  MeetingScheduleFormFields,
  type MeetingScheduleFormFieldsProps,
} from "@/modules/meetings/MeetingScheduleForm";
import {
  WorkCreateEventFields,
  WorkCreateTaskFields,
} from "@/modules/work/WorkCreateFormFields";
import { WorkCreateCategoryPicker } from "@/modules/work/WorkCreateCategoryPicker";
import {
  buildWorkCreateRecord,
  getWorkCreateResource,
} from "@/modules/work/workCreateDefaults";
import {
  isMeetingCreateCategory,
  isScheduledEventCreateCategory,
  isTaskCreateCategory,
  type WorkCreateCategory,
} from "@/modules/work/workCreateCategories";

export const WorkCreateDialog = ({
  open,
  onOpenChange,
  category,
  onCategoryChange,
  dateKey,
  initialTime = null,
  dealId,
  memberId,
  title = "Add to calendar",
  onTaskSuccess,
  onEventSuccess,
  transformCalendarEvent,
  meetingFormProps,
  onError,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: WorkCreateCategory;
  onCategoryChange: (next: WorkCreateCategory) => void;
  dateKey: string;
  initialTime?: string | null;
  dealId?: Identifier;
  memberId: Identifier;
  title?: string;
  onTaskSuccess: (data: Record<string, unknown>) => void | Promise<void>;
  onEventSuccess: (record?: Record<string, unknown>) => void | Promise<void>;
  transformCalendarEvent: (data: Record<string, unknown>) => Record<string, unknown>;
  meetingFormProps?: Omit<
    MeetingScheduleFormFieldsProps,
    "isEdit" | "embedded"
  >;
  onError?: (error: unknown) => void;
}) => {
  if (!open) return null;

  const resource = getWorkCreateResource(category);
  const record = buildWorkCreateRecord(category, {
    dateKey,
    initialTime,
    dealId,
    memberId,
  });

  const transform = isTaskCreateCategory(category)
    ? (data: Record<string, unknown>) =>
        normalizeTaskCreateData({
          ...data,
          deal_id: dealId ?? data.deal_id ?? null,
        })
    : transformCalendarEvent;

  const mutationMode: MutationMode | undefined =
    resource === "calendar_events" ? "pessimistic" : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-1/20 max-h-9/10 translate-y-0 overflow-y-auto lg:max-w-xl">
        <CreateBase
          key={category}
          resource={resource}
          record={record}
          transform={transform}
          mutationMode={mutationMode}
          mutationOptions={{
            onSuccess: (data) => {
              if (isTaskCreateCategory(category)) {
                void onTaskSuccess(data as Record<string, unknown>);
              } else {
                void onEventSuccess(data as Record<string, unknown>);
              }
            },
            onError,
          }}
          redirect={false}
        >
          <Form className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
            </DialogHeader>
            <WorkCreateCategoryPicker
              value={category}
              onChange={onCategoryChange}
            />
            {!isTaskCreateCategory(category) ? (
              <CalendarEventFormInitializer />
            ) : null}
            <div
              key={category}
              className="flex flex-col gap-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150"
            >
              {isTaskCreateCategory(category) ? (
                <WorkCreateTaskFields
                  category={category}
                  defaultDealId={dealId}
                />
              ) : null}
              {isMeetingCreateCategory(category) ? (
                <MeetingScheduleFormFields
                  isEdit={false}
                  embedded
                  {...meetingFormProps}
                />
              ) : null}
              {isScheduledEventCreateCategory(category) ? (
                <WorkCreateEventFields category={category} />
              ) : null}
            </div>
            <DialogFooter className="w-full justify-end gap-2">
              <DialogSaveButton label="Create" />
            </DialogFooter>
          </Form>
        </CreateBase>
      </DialogContent>
    </Dialog>
  );
};
