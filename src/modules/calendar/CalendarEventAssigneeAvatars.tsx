import type { OrganizationMember } from "@/components/atomic-crm/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SignedMemberAvatarImage } from "@/components/avatar/SignedMemberAvatarImage";
import {
  getMemberInitials,
  getMemberName,
} from "@/components/atomic-crm/tasks/taskMemberOptions";
import type { CalendarEvent } from "@/modules/calendar/calendarUtils";
import { getCalendarEventMemberIds } from "@/modules/calendar/calendarEventAssignees";
import { cn } from "@/lib/utils";

const MAX_VISIBLE = 2;

export const CalendarEventAssigneeAvatars = ({
  event,
  membersById,
  compact = false,
  className,
}: {
  event: CalendarEvent;
  membersById: Map<string, OrganizationMember>;
  compact?: boolean;
  className?: string;
}) => {
  const memberIds = getCalendarEventMemberIds(event);
  const members = memberIds
    .map((id) => membersById.get(String(id)))
    .filter((member): member is OrganizationMember => Boolean(member));

  if (members.length === 0) return null;

  const visible = members.slice(0, MAX_VISIBLE);
  const hiddenCount = Math.max(members.length - visible.length, 0);
  const avatarClass = compact ? "size-3.5 text-[8px]" : "size-4 text-[9px]";

  return (
    <span
      className={cn("inline-flex shrink-0 -space-x-1", className)}
      aria-hidden
    >
      {visible.map((member) => {
        const name = getMemberName(member);
        return (
          <Avatar
            key={String(member.id)}
            className={cn(avatarClass, "ring-1 ring-background")}
            title={name}
          >
            <SignedMemberAvatarImage member={member} size={64} alt={name} />
            <AvatarFallback className="bg-primary/10 font-medium text-primary">
              {getMemberInitials(member)}
            </AvatarFallback>
          </Avatar>
        );
      })}
      {hiddenCount > 0 ? (
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-muted font-medium text-muted-foreground ring-1 ring-background",
            compact ? "size-3.5 text-[8px]" : "size-4 text-[9px]",
          )}
        >
          +{hiddenCount}
        </span>
      ) : null}
    </span>
  );
};
