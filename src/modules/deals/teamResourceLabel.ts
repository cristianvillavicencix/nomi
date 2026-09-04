/** Team photo labels are stored as "Name — Role" on deal_resources.label. */

export const formatTeamResourceLabel = (input: {
  name?: string | null;
  role?: string | null;
  fallback?: string | null;
}) => {
  const name = String(input.name ?? "").trim();
  const role = String(input.role ?? "").trim();
  if (name && role) return `${name} — ${role}`;
  if (name) return name;
  if (role) return role;
  return String(input.fallback ?? "").trim() || "Team photo";
};

export const parseTeamResourceLabel = (label?: string | null) => {
  const raw = String(label ?? "").trim();
  if (!raw) return { name: "", role: "" };
  const separator = " — ";
  const index = raw.indexOf(separator);
  if (index === -1) return { name: raw, role: "" };
  return {
    name: raw.slice(0, index).trim(),
    role: raw.slice(index + separator.length).trim(),
  };
};
