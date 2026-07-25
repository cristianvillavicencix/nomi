import { useDraggable } from "@dnd-kit/core";
import type { OrganizationMember } from "@/components/atomic-crm/types";
import { CalendarInteractiveEventChip } from "@/modules/calendar/CalendarInteractiveEventChip";
import {
  canRescheduleCalendarEvent,
  getCalendarEventDragId,
} from "@/modules/calendar/calendarEventReschedule";
import type { CalendarEvent } from "@/modules/calendar/calendarUtils";
import type { CalendarBusinessHoursSchedule } from "@/modules/calendar/calendarBusinessHours";
import { cn } from "@/lib/utils";

export const CalendarDraggableEventChip = ({
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
  schedule?: CalendarBusinessHoursSchedule;
}) => {
  const draggable = canRescheduleCalendarEvent(event);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: getCalendarEventDragId(event),
    data: { event },
    disabled: !draggable,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "touch-none",
        draggable && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
      {...(draggable ? listeners : undefined)}
      {...(draggable ? attributes : undefined)}
    >
      <CalendarInteractiveEventChip
        event={event}
        compact={compact}
        onClick={onClick}
        onEdit={onEdit}
        outsideBusinessHours={outsideBusinessHours}
        enablePreview={enablePreview && !isDragging}
        showAssigneeAvatars={showAssigneeAvatars}
        membersById={membersById}
      />
    </div>
  );
};
