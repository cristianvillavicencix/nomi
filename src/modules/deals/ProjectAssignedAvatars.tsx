import type { MouseEvent } from "react";
import { Link } from "react-router";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  initialsOf,
} from "@/components/avatar/resolveAvatar";
import { SignedMemberAvatarImage } from "@/components/avatar/SignedMemberAvatarImage";
import type { Deal, OrganizationMember } from "@/components/atomic-crm/types";

const getMemberName = (
  member: Pick<OrganizationMember, "first_name" | "last_name">,
) =>
  [member.first_name, member.last_name].filter(Boolean).join(" ") ||
  "Team member";

type ProjectAssignedAvatarsProps = {
  deal: Deal;
  membersById: Record<string, OrganizationMember>;
  onClick?: (event: MouseEvent) => void;
};

export const ProjectAssignedAvatars = ({
  deal,
  membersById,
  onClick,
}: ProjectAssignedAvatarsProps) => {
  const assignedIds = Array.isArray(deal.salesperson_ids)
    ? deal.salesperson_ids.map(String).filter(Boolean)
    : [];

  if (assignedIds.length > 0) {
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
                  <SignedMemberAvatarImage
                    member={member}
                    size={64}
                    alt={getMemberName(member)}
                  />
                  <AvatarFallback className="bg-muted text-[10px] font-medium">
                    {initialsOf(member)}
                  </AvatarFallback>
                </Avatar>
              </Link>
            ))}
          </div>
        </div>
      );
    }
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
        <SignedMemberAvatarImage member={member} size={64} alt={name} />
        <AvatarFallback className="bg-muted text-[10px] font-medium">
          {initialsOf(member)}
        </AvatarFallback>
      </Avatar>
    </Link>
  );
};
