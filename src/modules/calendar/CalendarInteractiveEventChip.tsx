import type { OrganizationMember } from "@/components/atomic-crm/types";
import { CalendarEventChip } from "@/modules/calendar/CalendarEventChip";
import { CalendarEventPreviewPopover } from "@/modules/calendar/CalendarEventPreviewPopover";
import type { CalendarEvent } from "@/modules/calendar/calendarUtils";
import { cn } from "@/lib/utils";

export const CalendarInteractiveEventChip = ({
  event,
  compact = false,
  onClick,
  onEdit,
  outsideBusinessHours = false,
  enablePreview = true,
  showAssigneeAvatars = false,
  membersById,
}: {
  event: CalendarEvent;
  compact?: boolean;
  onClick?: (event: CalendarEvent) => void;
  onEdit: (event: CalendarEvent) => void;
  outsideBusinessHours?: boolean;
  enablePreview?: boolean;
  showAssigneeAvatars?: boolean;
  membersById?: Map<string, OrganizationMember>;
}) => {
  const chip = (
    <CalendarEventChip
      event={event}
      compact={compact}
      onClick={onClick}
      showAssigneeAvatars={showAssigneeAvatars}
      membersById={membersById}
      className={cn(
        outsideBusinessHours &&
          "ring-1 ring-amber-400/80 ring-offset-1 dark:ring-amber-600/80",
      )}
    />
  );

  if (!enablePreview) return chip;

  return (
    <CalendarEventPreviewPopover
      event={event}
      onEdit={onEdit}
      outsideBusinessHours={outsideBusinessHours}
      membersById={membersById}
    >
      {chip}
    </CalendarEventPreviewPopover>
  );
};
