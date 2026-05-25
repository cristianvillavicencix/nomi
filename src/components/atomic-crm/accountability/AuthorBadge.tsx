import { useGetOne, type Identifier } from "ra-core";
import { Link } from "react-router";
import { useIsAdminLevel } from "@/lib/permissions/useIsAdminLevel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { OrganizationMember } from "@/components/atomic-crm/types";

interface AuthorBadgeProps {
  memberId: Identifier | null | undefined;
  size?: "sm" | "md";
  variant?: "inline" | "block";
}

export function AuthorBadge({
  memberId,
  size = "sm",
  variant = "inline",
}: AuthorBadgeProps) {
  const isAdminLevel = useIsAdminLevel();

  const { data: member } = useGetOne<OrganizationMember>(
    "organization_members",
    { id: memberId! },
    { enabled: isAdminLevel && memberId != null },
  );

  if (!isAdminLevel || !memberId || !member) return null;

  const fullName =
    `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim();
  const initials = fullName
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const avatarSize = size === "sm" ? "size-5" : "size-7";

  return (
    <Link
      to={`/organization_members/${memberId}`}
      className={`inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground ${variant === "block" ? "mt-1" : ""}`}
    >
      <Avatar className={avatarSize}>
        <AvatarImage src={member.avatar?.src} alt={fullName} />
        <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
      </Avatar>
      <span className="hover:underline">{fullName}</span>
    </Link>
  );
}
