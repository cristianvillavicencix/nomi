import type { MouseEvent } from "react";
import { Link } from "react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Deal, OrganizationMember, Person } from "@/components/atomic-crm/types";
import { isLbsMode } from "@/lbs/productMode";

const getPersonInitials = (person: Pick<Person, "first_name" | "last_name">) => {
  const first = (person.first_name ?? "").trim().charAt(0);
  const last = (person.last_name ?? "").trim().charAt(0);
  const initials = `${first}${last}`.toUpperCase();
  return initials || "—";
};

const getMemberInitials = (member: Pick<OrganizationMember, "first_name" | "last_name">) => {
  const first = (member.first_name ?? "").trim().charAt(0);
  const last = (member.last_name ?? "").trim().charAt(0);
  const initials = `${first}${last}`.toUpperCase();
  return initials || "—";
};

const getPersonName = (person: Pick<Person, "first_name" | "last_name">) =>
  [person.first_name, person.last_name].filter(Boolean).join(" ") || "Team member";

const getMemberName = (member: Pick<OrganizationMember, "first_name" | "last_name">) =>
  [member.first_name, member.last_name].filter(Boolean).join(" ") || "Team member";

type ProjectAssignedAvatarsProps = {
  deal: Deal;
  peopleById: Record<string, Person>;
  membersById: Record<string, OrganizationMember>;
  onClick?: (event: MouseEvent) => void;
};

export const ProjectAssignedAvatars = ({
  deal,
  peopleById,
  membersById,
  onClick,
}: ProjectAssignedAvatarsProps) => {
  const lbsMode = isLbsMode();
  const assignedIds = Array.isArray(deal.salesperson_ids)
    ? deal.salesperson_ids.map(String).filter(Boolean)
    : [];

  if (lbsMode && assignedIds.length > 0) {
    const assignedMembers = assignedIds
      .map((id) => membersById[id])
      .filter((member): member is OrganizationMember => Boolean(member));

    if (assignedMembers.length > 0) {
      return (
        <div className="flex items-center">
          <div className="flex -space-x-2">
            {assignedMembers.map((member) => (
              <Link
                key={String(member.id)}
                to={`/organization_members/${member.id}`}
                title={getMemberName(member)}
                aria-label={getMemberName(member)}
                className="rounded-full ring-2 ring-background transition-transform hover:z-10 hover:scale-105"
                onClick={onClick}
              >
                <Avatar className="size-7">
                  <AvatarImage src={member.avatar?.src ?? undefined} alt={getMemberName(member)} />
                  <AvatarFallback className="bg-muted text-[10px] font-medium">
                    {getMemberInitials(member)}
                  </AvatarFallback>
                </Avatar>
              </Link>
            ))}
          </div>
        </div>
      );
    }
  }

  const peopleIds = assignedIds;
  const assignedPeople = peopleIds
    .map((id) => peopleById[id])
    .filter((person): person is Person => Boolean(person));

  if (lbsMode && assignedPeople.length > 0) {
    return (
      <div className="flex items-center">
        <div className="flex -space-x-2">
          {assignedPeople.map((person) => (
            <Link
              key={String(person.id)}
              to={`/people/${person.id}/show`}
              title={getPersonName(person)}
              aria-label={getPersonName(person)}
              className="rounded-full ring-2 ring-background transition-transform hover:z-10 hover:scale-105"
              onClick={onClick}
            >
              <Avatar className="size-7">
                <AvatarFallback className="bg-muted text-[10px] font-medium">
                  {getPersonInitials(person)}
                </AvatarFallback>
              </Avatar>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const member = deal.organization_member_id
    ? membersById[String(deal.organization_member_id)]
    : undefined;

  if (!member) {
    return <span className="text-muted-foreground">—</span>;
  }

  const href = `/organization_members/${member.id}`;
  const name = getMemberName(member);

  return (
    <Link
      to={href}
      title={name}
      aria-label={name}
      className="inline-flex rounded-full ring-2 ring-background transition-transform hover:scale-105"
      onClick={onClick}
    >
      <Avatar className="size-7">
        <AvatarImage src={member.avatar?.src ?? undefined} alt={name} />
        <AvatarFallback className="bg-muted text-[10px] font-medium">
          {getMemberInitials(member)}
        </AvatarFallback>
      </Avatar>
    </Link>
  );
};
