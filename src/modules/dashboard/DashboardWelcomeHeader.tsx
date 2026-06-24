import { useGetIdentity } from "ra-core";
import { useMemo } from "react";

const getGreeting = (hour: number) => {
  if (hour < 12) return { emoji: "☕️", label: "Morning" };
  if (hour < 17) return { emoji: "👋", label: "Afternoon" };
  return { emoji: "🌙", label: "Evening" };
};

const getFirstName = (fullName?: string | null) => {
  const trimmed = fullName?.trim();
  if (!trimmed) return null;
  return trimmed.split(/\s+/)[0] ?? trimmed;
};

export const DashboardWelcomeHeader = () => {
  const { identity } = useGetIdentity();

  const greeting = useMemo(() => getGreeting(new Date().getHours()), []);
  const firstName = getFirstName(identity?.fullName);

  return (
    <header className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
        {greeting.emoji} {greeting.label}
        {firstName ? `, ${firstName}` : ""}, welcome back
      </h1>
    </header>
  );
};
