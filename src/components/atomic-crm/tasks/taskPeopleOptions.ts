import type { Person } from "@/components/atomic-crm/types";

export const getPersonOptionText = (person?: Partial<Person>) => {
  if (!person) return "";
  const fullName = [person.first_name, person.last_name]
    .filter(Boolean)
    .join(" ");
  if (person.email) return `${fullName} (${person.email})`;
  return fullName;
};

export const getPersonName = (
  person: Pick<Person, "first_name" | "last_name">,
) =>
  [person.first_name, person.last_name].filter(Boolean).join(" ") ||
  "Team member";

export const getPersonInitials = (
  person: Pick<Person, "first_name" | "last_name">,
) => {
  const first = (person.first_name ?? "").trim().charAt(0);
  const last = (person.last_name ?? "").trim().charAt(0);
  const initials = `${first}${last}`.toUpperCase();
  return initials || "—";
};
