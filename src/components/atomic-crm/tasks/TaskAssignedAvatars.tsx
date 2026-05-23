import { Link } from "react-router";
import { useGetList } from "ra-core";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type {
  OrganizationMember,
  Person,
  Task,
  TaskParticipant,
} from "@/components/atomic-crm/types";
import {
  getPersonInitials,
  getPersonName,
} from "@/components/atomic-crm/tasks/taskPeopleOptions";
import { isParticipantComplete } from "@/components/atomic-crm/tasks/taskParticipants";

type TaskAssignedAvatarsProps = {
  task: Task;
  participants?: TaskParticipant[];
  size?: "sm" | "md";
};

const getMemberInitials = (
  member: Pick<OrganizationMember, "first_name" | "last_name">,
) => {
  const first = (member.first_name ?? "").trim().charAt(0);
  const last = (member.last_name ?? "").trim().charAt(0);
  return `${first}${last}`.toUpperCase() || "—";
};

const getMemberName = (
  member: Pick<OrganizationMember, "first_name" | "last_name">,
) =>
  [member.first_name, member.last_name].filter(Boolean).join(" ") || "CRM user";

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
  const allPeopleIds = Array.from(
    new Set([...assigneeIds, ...collaboratorIds]),
  );

  const { data: people = [] } = useGetList<Person>(
    "people",
    {
      filter:
        allPeopleIds.length > 0
          ? { "id@in": `(${allPeopleIds.join(",")})` }
          : { "id@eq": -1 },
      pagination: { page: 1, perPage: Math.max(allPeopleIds.length, 1) },
      sort: { field: "id", order: "ASC" },
    },
    { enabled: allPeopleIds.length > 0, staleTime: 60_000 },
  );

  const { data: members = [] } = useGetList<OrganizationMember>(
    "organization_members",
    {
      filter:
        mentionedMemberIds.length > 0
          ? { "id@in": `(${mentionedMemberIds.join(",")})` }
          : { "id@eq": -1 },
      pagination: { page: 1, perPage: Math.max(mentionedMemberIds.length, 1) },
      sort: { field: "id", order: "ASC" },
    },
    { enabled: mentionedMemberIds.length > 0, staleTime: 60_000 },
  );

  const peopleById = Object.fromEntries(
    people.map((person) => [String(person.id), person]),
  );
  const assignees = assigneeIds
    .map((id) => peopleById[id])
    .filter((person): person is Person => Boolean(person));
  const collaborators = collaboratorIds
    .filter((id) => !assigneeIds.includes(id))
    .map((id) => peopleById[id])
    .filter((person): person is Person => Boolean(person));

  if (
    assignees.length === 0 &&
    collaborators.length === 0 &&
    members.length === 0
  ) {
    return <span className="text-muted-foreground">—</span>;
  }

  const avatarClass = size === "md" ? "size-8" : "size-7";
  const textClass = size === "md" ? "text-xs" : "text-[10px]";
  const completedAvatarClass = "grayscale opacity-50";

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {assignees.map((person) => {
          const done = isParticipantComplete(participants, {
            personId: person.id,
          });
          return (
            <Link
              key={`assignee-${String(person.id)}`}
              to={`/people/${person.id}/show`}
              title={`${getPersonName(person)} · Assignee${done ? " · Done" : ""}`}
              aria-label={`${getPersonName(person)} · Assignee${done ? " · Done" : ""}`}
              className={cn(
                "rounded-full ring-2 ring-background transition-transform hover:z-10 hover:scale-105",
                done && completedAvatarClass,
              )}
            >
              <Avatar className={avatarClass}>
                <AvatarFallback
                  className={`bg-primary/10 text-primary ${textClass} font-medium`}
                >
                  {getPersonInitials(person)}
                </AvatarFallback>
              </Avatar>
            </Link>
          );
        })}
        {collaborators.map((person) => {
          const done = isParticipantComplete(participants, {
            personId: person.id,
          });
          return (
            <Link
              key={`collaborator-${String(person.id)}`}
              to={`/people/${person.id}/show`}
              title={`${getPersonName(person)} · Collaborator${done ? " · Done" : ""}`}
              aria-label={`${getPersonName(person)} · Collaborator${done ? " · Done" : ""}`}
              className={cn(
                "rounded-full ring-2 ring-dashed ring-muted-foreground/40 transition-transform hover:z-10 hover:scale-105",
                done && completedAvatarClass,
              )}
            >
              <Avatar className={avatarClass}>
                <AvatarFallback className={`bg-muted ${textClass} font-medium`}>
                  {getPersonInitials(person)}
                </AvatarFallback>
              </Avatar>
            </Link>
          );
        })}
        {members.map((member) => {
          const done = isParticipantComplete(participants, {
            memberId: member.id,
          });
          return (
            <Link
              key={`member-${String(member.id)}`}
              to={`/organization_members/${member.id}`}
              title={`${getMemberName(member)} · CRM user${done ? " · Done" : ""}`}
              aria-label={`${getMemberName(member)} · CRM user${done ? " · Done" : ""}`}
              className={cn(
                "rounded-full ring-2 ring-blue-200 transition-transform hover:z-10 hover:scale-105",
                done && completedAvatarClass,
              )}
            >
              <Avatar className={avatarClass}>
                <AvatarImage
                  src={member.avatar?.src ?? undefined}
                  alt={getMemberName(member)}
                />
                <AvatarFallback
                  className={`bg-blue-50 text-blue-700 ${textClass} font-medium`}
                >
                  {getMemberInitials(member)}
                </AvatarFallback>
              </Avatar>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
