import { useState } from "react";
import type { OrganizationMember } from "@/components/atomic-crm/types";
import { CalendarInteractiveEventChip } from "@/modules/calendar/CalendarInteractiveEventChip";
import { CalendarDraggableEventChip } from "@/modules/calendar/CalendarDraggableEventChip";
import type { CalendarBusinessHoursSchedule } from "@/modules/calendar/calendarBusinessHours";
import { isEventOutsideBusinessHours } from "@/modules/calendar/calendarBusinessHours";
import type { CalendarEvent } from "@/modules/calendar/calendarUtils";
import { calendarEventPreviewController } from "@/modules/calendar/calendarEventPreviewController";
import { shouldUseTimeSlotOverflow } from "@/modules/calendar/calendarEventStackUtils";
import { CalendarTimeSlotOverflowChip } from "@/modules/calendar/CalendarTimeSlotOverflowChip";
import { cn } from "@/lib/utils";

/** Wide fan spacing — cards peek clearly without overlapping titles. */
const STACK_OFFSET_PX = 14;

export type CalendarEventStackFanDirection = "horizontal" | "vertical";

const renderStackChip = ({
  event,
  compact,
  onSelectEvent,
  onEditEvent,
  showAssigneeAvatars,
  membersById,
  schedule,
  enablePreview,
  enableDrag = false,
}: {
  event: CalendarEvent;
  compact: boolean;
  onSelectEvent: (event: CalendarEvent) => void;
  onEditEvent: (event: CalendarEvent) => void;
  showAssigneeAvatars: boolean;
  membersById?: Map<string, OrganizationMember>;
  schedule?: CalendarBusinessHoursSchedule;
  enablePreview: boolean;
  enableDrag?: boolean;
}) => {
  const ChipComponent = enableDrag
    ? CalendarDraggableEventChip
    : CalendarInteractiveEventChip;

  return (
    <ChipComponent
    event={event}
    compact={compact}
    onClick={onSelectEvent}
    onEdit={onEditEvent}
    enablePreview={enablePreview}
    showAssigneeAvatars={showAssigneeAvatars}
    membersById={membersById}
    outsideBusinessHours={
      schedule
        ? isEventOutsideBusinessHours(
            {
              date: event.date,
              time: "time" in event ? event.time : null,
            },
            schedule,
          )
        : false
    }
    />
  );
};

export const CalendarEventStack = ({
  events,
  compact = false,
  fanDirection = "horizontal",
  onSelectEvent,
  onEditEvent,
  showAssigneeAvatars = false,
  membersById,
  schedule,
  className,
  enableDrag = false,
}: {
  events: CalendarEvent[];
  compact?: boolean;
  fanDirection?: CalendarEventStackFanDirection;
  onSelectEvent: (event: CalendarEvent) => void;
  onEditEvent: (event: CalendarEvent) => void;
  showAssigneeAvatars?: boolean;
  membersById?: Map<string, OrganizationMember>;
  schedule?: CalendarBusinessHoursSchedule;
  className?: string;
  enableDrag?: boolean;
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (events.length === 0) return null;

  if (shouldUseTimeSlotOverflow(events.length)) {
    return (
      <CalendarTimeSlotOverflowChip
        events={events}
        compact={compact}
        onSelectEvent={onSelectEvent}
        onEditEvent={onEditEvent}
        showAssigneeAvatars={showAssigneeAvatars}
        membersById={membersById}
        schedule={schedule}
        className={className}
      />
    );
  }

  if (events.length === 1) {
    return renderStackChip({
      event: events[0],
      compact,
      onSelectEvent,
      onEditEvent,
      showAssigneeAvatars,
      membersById,
      schedule,
      enablePreview: true,
      enableDrag,
    });
  }

  const chipHeight = compact ? 22 : 28;
  const fanDepth = STACK_OFFSET_PX * (events.length - 1);
  const isVertical = fanDirection === "vertical";

  return (
    <div
      className={cn("relative isolate w-full", className)}
      style={{
        height: isVertical ? chipHeight + fanDepth : chipHeight,
        marginRight: isVertical ? 0 : fanDepth,
      }}
      onMouseLeave={() => {
        setHoveredId(null);
        calendarEventPreviewController.closeImmediately();
      }}
    >
      {!hoveredId ? (
        <span className="pointer-events-none absolute -right-1 -top-1 z-[2] rounded-full border bg-background px-1 text-[9px] font-medium tabular-nums text-muted-foreground shadow-sm">
          {events.length}
        </span>
      ) : null}

      {events.map((event, index) => {
        const isHovered = hoveredId === String(event.id);
        const isDimmed = hoveredId != null && !isHovered;
        const offset = index * STACK_OFFSET_PX;

        if (isVertical) {
          return (
            <div
              key={event.id}
              className={cn(
                "absolute inset-x-0 transition-all duration-200 ease-out",
                isHovered ? "z-[5]" : "z-[1]",
              )}
              style={{
                top: isHovered ? 0 : offset,
                height: chipHeight,
                opacity: isDimmed ? 0.25 : 1,
                filter: isDimmed ? "blur(0.3px)" : undefined,
                pointerEvents:
                  hoveredId != null && !isHovered ? "none" : "auto",
              }}
              onMouseEnter={() => {
                const id = String(event.id);
                setHoveredId(id);
                calendarEventPreviewController.scheduleOpen(id);
              }}
            >
              {renderStackChip({
                event,
                compact,
                onSelectEvent,
                onEditEvent,
                showAssigneeAvatars,
                membersById,
                schedule,
                enablePreview: hoveredId === String(event.id),
                enableDrag,
              })}
            </div>
          );
        }

        return (
          <div
            key={event.id}
            className={cn(
              "absolute top-0 transition-all duration-200 ease-out",
              isHovered ? "z-[5] w-full" : "z-[1]",
            )}
            style={{
              left: isHovered ? 0 : offset,
              width: isHovered
                ? "100%"
                : `calc(100% - ${Math.max(events.length - 1 - index, 0) * STACK_OFFSET_PX}px)`,
              opacity: isDimmed ? 0.25 : 1,
              filter: isDimmed ? "blur(0.3px)" : undefined,
              pointerEvents:
                hoveredId != null && !isHovered ? "none" : "auto",
            }}
            onMouseEnter={() => {
              const id = String(event.id);
              setHoveredId(id);
              calendarEventPreviewController.scheduleOpen(id);
            }}
            onMouseLeave={() => {
              calendarEventPreviewController.scheduleClose(String(event.id));
            }}
          >
            {renderStackChip({
              event,
              compact,
              onSelectEvent,
              onEditEvent,
              showAssigneeAvatars,
              membersById,
              schedule,
              enablePreview: hoveredId === String(event.id),
              enableDrag,
            })}
          </div>
        );
      })}
    </div>
  );
};

export const CalendarTimedEventStack = ({
  blocks,
  onSelectEvent,
  onEditEvent,
  showAssigneeAvatars = false,
  membersById,
  schedule,
  enableDrag = false,
}: {
  blocks: Array<{ event: CalendarEvent; topPx: number; heightPx: number }>;
  onSelectEvent: (event: CalendarEvent) => void;
  onEditEvent: (event: CalendarEvent) => void;
  showAssigneeAvatars?: boolean;
  membersById?: Map<string, OrganizationMember>;
  schedule: CalendarBusinessHoursSchedule;
  enableDrag?: boolean;
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (blocks.length === 0) return null;

  const topPx = blocks[0].topPx;
  const heightPx = Math.max(...blocks.map((block) => block.heightPx));
  const events = blocks.map((block) => block.event);

  if (shouldUseTimeSlotOverflow(blocks.length)) {
    return (
      <div
        className="absolute inset-x-1 z-10"
        style={{ top: topPx, height: heightPx }}
      >
        <CalendarTimeSlotOverflowChip
          events={events}
          onSelectEvent={onSelectEvent}
          onEditEvent={onEditEvent}
          showAssigneeAvatars={showAssigneeAvatars}
          membersById={membersById}
          schedule={schedule}
        />
      </div>
    );
  }

  if (blocks.length === 1) {
    const { event } = blocks[0];
    return (
      <div
        className="absolute inset-x-1 z-10 overflow-hidden"
        style={{ top: topPx, height: heightPx }}
      >
        {renderStackChip({
          event,
          compact: false,
          onSelectEvent,
          onEditEvent,
          showAssigneeAvatars,
          membersById,
          schedule,
          enablePreview: true,
          enableDrag,
        })}
      </div>
    );
  }

  const fanWidth = STACK_OFFSET_PX * (blocks.length - 1);

  return (
    <div
      className="absolute inset-x-1 isolate z-10"
      style={{ top: topPx, height: heightPx, marginRight: fanWidth }}
      onMouseLeave={() => {
        setHoveredId(null);
        calendarEventPreviewController.closeImmediately();
      }}
    >
      {!hoveredId ? (
        <span className="pointer-events-none absolute right-0 top-0 z-[2] rounded-full border bg-background px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground shadow-sm">
          {blocks.length}
        </span>
      ) : null}

      {blocks.map((block, index) => {
        const { event } = block;
        const isHovered = hoveredId === String(event.id);
        const isDimmed = hoveredId != null && !isHovered;
        const offset = index * STACK_OFFSET_PX;

        return (
          <div
            key={event.id}
            className={cn(
              "absolute inset-y-0 overflow-hidden transition-all duration-200 ease-out",
              isHovered ? "z-[5] left-0 right-0" : "z-[1]",
            )}
            style={{
              left: isHovered ? 0 : offset,
              right: isHovered ? 0 : fanWidth - offset,
              opacity: isDimmed ? 0.2 : 1,
              pointerEvents:
                hoveredId != null && !isHovered ? "none" : "auto",
            }}
            onMouseEnter={() => {
              const id = String(event.id);
              setHoveredId(id);
              calendarEventPreviewController.scheduleOpen(id);
            }}
            onMouseLeave={() => {
              calendarEventPreviewController.scheduleClose(String(event.id));
            }}
          >
            {renderStackChip({
              event,
              compact: false,
              onSelectEvent,
              onEditEvent,
              showAssigneeAvatars,
              membersById,
              schedule,
              enablePreview: hoveredId === String(event.id),
              enableDrag,
            })}
          </div>
        );
      })}
    </div>
  );
};
