import { Link } from "react-router";
import { useGetList } from "ra-core";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type {
  OrganizationMember,
  Task,
  TaskParticipant,
} from "@/components/atomic-crm/types";
import {
  getMemberInitials,
  getMemberName,
} from "@/components/atomic-crm/tasks/taskMemberOptions";
import { isParticipantComplete } from "@/components/atomic-crm/tasks/taskParticipants";

type TaskAssignedAvatarsProps = {
  task: Task;
  participants?: TaskParticipant[];
  size?: "sm" | "md";
};

export const TaskAssignedAvatars = ({
  task,
  participants = [],
  size = "sm",
}: TaskAssignedAvatarsProps) => {
  const assigneeIds = Array.isArray(task.assignee_person_ids)
    ? task.assignee_person_ids.map(String).filter(Boolean)
    : [];
  const collaboratorIds = Array.isArray(task.collaborator_person_ids)
    ? task.collaborator_person_ids.map(String).filter(Boolean)
    : [];
  const mentionedMemberIds = Array.isArray(task.mentioned_member_ids)
    ? task.mentioned_member_ids.map(String).filter(Boolean)
    : [];
  const allMemberIds = Array.from(
    new Set([...assigneeIds, ...collaboratorIds, ...mentionedMemberIds]),
  );

  const { data: members = [] } = useGetList<OrganizationMember>(
    "organization_members",
    {
      filter:
        allMemberIds.length > 0
          ? { "id@in": `(${allMemberIds.join(",")})` }
          : { "id@eq": -1 },
      pagination: { page: 1, perPage: Math.max(allMemberIds.length, 1) },
      sort: { field: "id", order: "ASC" },
    },
    { enabled: allMemberIds.length > 0, staleTime: 60_000 },
  );

  const membersById = Object.fromEntries(
    members.map((member) => [String(member.id), member]),
  );
  const assignees = assigneeIds
    .map((id) => membersById[id])
    .filter((member): member is OrganizationMember => Boolean(member));
  const collaborators = collaboratorIds
    .filter((id) => !assigneeIds.includes(id))
    .map((id) => membersById[id])
    .filter((member): member is OrganizationMember => Boolean(member));
  const mentionedOnly = mentionedMemberIds
    .filter((id) => !assigneeIds.includes(id) && !collaboratorIds.includes(id))
    .map((id) => membersById[id])
    .filter((member): member is OrganizationMember => Boolean(member));

  if (
    assignees.length === 0 &&
    collaborators.length === 0 &&
    mentionedOnly.length === 0
  ) {
    return <span className="text-muted-foreground">—</span>;
  }

  const avatarClass = size === "md" ? "size-8" : "size-7";
  const textClass = size === "md" ? "text-xs" : "text-[10px]";
  const completedAvatarClass = "grayscale opacity-50";

  const renderMemberAvatar = (
    member: OrganizationMember,
    role: "Assignee" | "Collaborator" | "Mentioned",
    linkClassName: string,
  ) => {
    const done = isParticipantComplete(participants, { memberId: member.id });
    const name = getMemberName(member);
    return (
      <Link
        key={`${role}-${String(member.id)}`}
        to={`/organization_members/${member.id}`}
        title={`${name} · ${role}${done ? " · Done" : ""}`}
        aria-label={`${name} · ${role}${done ? " · Done" : ""}`}
        className={cn(
          linkClassName,
          done && completedAvatarClass,
        )}
      >
        <Avatar className={avatarClass}>
          <AvatarImage
            src={member.avatar?.src ?? undefined}
            alt={name}
          />
          <AvatarFallback
            className={cn(
              textClass,
              "font-medium",
              role === "Assignee"
                ? "bg-primary/10 text-primary"
                : role === "Collaborator"
                  ? "bg-muted"
                  : "bg-blue-50 text-blue-700",
            )}
          >
            {getMemberInitials(member)}
          </AvatarFallback>
        </Avatar>
      </Link>
    );
  };

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {assignees.map((member) =>
          renderMemberAvatar(
            member,
            "Assignee",
            "rounded-full ring-2 ring-background transition-transform hover:z-10 hover:scale-105",
          ),
        )}
        {collaborators.map((member) =>
          renderMemberAvatar(
            member,
            "Collaborator",
            "rounded-full ring-2 ring-dashed ring-muted-foreground/40 transition-transform hover:z-10 hover:scale-105",
          ),
        )}
        {mentionedOnly.map((member) =>
          renderMemberAvatar(
            member,
            "Mentioned",
            "rounded-full ring-2 ring-blue-200 transition-transform hover:z-10 hover:scale-105",
          ),
        )}
      </div>
    </div>
  );
};
