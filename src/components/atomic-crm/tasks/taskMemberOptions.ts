import type { OrganizationMember } from "@/components/atomic-crm/types";

export const getMemberOptionText = (member?: Partial<OrganizationMember>) => {
  if (!member) return "";
  const fullName = [member.first_name, member.last_name]
    .filter(Boolean)
    .join(" ");
  if (member.email) return `${fullName} (${member.email})`;
  return fullName || member.email || "";
};

export const getMemberName = (
  member: Pick<OrganizationMember, "first_name" | "last_name" | "email">,
) =>
  [member.first_name, member.last_name].filter(Boolean).join(" ") ||
  member.email?.trim() ||
  "Team member";

export const getMemberInitials = (
  member: Pick<OrganizationMember, "first_name" | "last_name" | "email">,
) => {
  const first = (member.first_name ?? "").trim().charAt(0);
  const last = (member.last_name ?? "").trim().charAt(0);
  const initials = `${first}${last}`.toUpperCase();
  if (initials) return initials;
  return (member.email ?? "").trim().charAt(0).toUpperCase() || "—";
};
