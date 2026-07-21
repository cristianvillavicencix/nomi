import type { OrganizationMember } from "@/components/atomic-crm/types";
import type { CalendarEvent } from "@/modules/calendar/calendarUtils";
import { CalendarEventAssigneeAvatars } from "@/modules/calendar/CalendarEventAssigneeAvatars";
import { getCalendarEventAssigneeColorClassName } from "@/modules/calendar/calendarAssigneeColors";
import {
  getEventClassName,
  getEventLabel,
} from "@/modules/calendar/calendarUtils";
import { cn } from "@/lib/utils";

export const CalendarEventChip = ({
  event,
  compact = false,
  onClick,
  static: isStatic = false,
  className: extraClassName,
  showAssigneeAvatars = false,
  membersById,
}: {
  event: CalendarEvent;
  compact?: boolean;
  onClick?: (event: CalendarEvent) => void;
  static?: boolean;
  className?: string;
  showAssigneeAvatars?: boolean;
  membersById?: Map<string, OrganizationMember>;
}) => {
  const typeClassName = getEventClassName(event);
  const assigneeClassName = getCalendarEventAssigneeColorClassName(event);
  const isMuted =
    typeClassName.includes("line-through") ||
    typeClassName.includes("text-muted-foreground");
  const className = cn(
    "block w-full rounded border px-1.5 text-left text-[11px] font-medium leading-5 transition-opacity",
    compact ? "py-0" : "py-0.5",
    onClick && !isStatic && "hover:opacity-80",
    isMuted ? typeClassName : (assigneeClassName ?? typeClassName),
    extraClassName,
  );
  const label = getEventLabel(event);
  const content = (
    <span className="flex min-w-0 items-center gap-1">
      {showAssigneeAvatars && membersById ? (
        <CalendarEventAssigneeAvatars
          event={event}
          membersById={membersById}
          compact={compact}
        />
      ) : null}
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </span>
  );

  if (isStatic || !onClick) {
    return (
      <div className={className} title={label}>
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={(clickEvent) => {
        clickEvent.stopPropagation();
        onClick(event);
      }}
      className={className}
      title={label}
    >
      {content}
    </button>
  );
};
