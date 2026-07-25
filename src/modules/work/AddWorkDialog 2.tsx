import { useState } from "react";
import {
  useDataProvider,
  useGetIdentity,
  useNotify,
  useRefresh,
  type Identifier,
} from "ra-core";
import {
  isMeetingCreateCategory,
  type WorkCreateCategory,
} from "@/modules/work/workCreateCategories";
import { WorkCreateDialog } from "@/modules/work/WorkCreateDialog";
import { prepareCalendarEventWriteData } from "@/modules/calendar/calendarEventWriteData";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import { DEFAULT_ORG_TIMEZONE } from "@/lib/timezone/usTimezone";

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
  const config = useConfigurationContext();
  const workspaceTimezone =
    String(config.companyTimezone ?? "").trim() || DEFAULT_ORG_TIMEZONE;
  const [category, setCategory] = useState<WorkCreateCategory>("task");
  const defaultDate = dueDate ?? new Date().toISOString().slice(0, 10);

  if (!identity) return null;

  const closeDialog = () => {
    setCategory("task");
    onOpenChange(false);
  };

  const handleCategoryChange = (next: WorkCreateCategory) => {
    if (isMeetingCreateCategory(next) && onScheduleMeeting) {
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

  if (!open) return null;

  if (isMeetingCreateCategory(category) && onScheduleMeeting) {
    return null;
  }

  return (
    <WorkCreateDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) closeDialog();
        else onOpenChange(next);
      }}
      category={category}
      onCategoryChange={handleCategoryChange}
      dateKey={defaultDate}
      dealId={dealId}
      memberId={identity.id}
      title="Add to Calendar"
      onTaskSuccess={handleTaskSuccess}
      onEventSuccess={handleEventSuccess}
      transformCalendarEvent={(data) =>
        prepareCalendarEventWriteData(
          {
            ...data,
            timezone: String(data.timezone ?? "").trim() || workspaceTimezone,
          },
          { defaultTimezone: workspaceTimezone },
        )
      }
    />
  );
};
