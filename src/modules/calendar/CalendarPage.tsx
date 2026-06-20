import { Navigate, useSearchParams } from "react-router";

/** Legacy calendar route — keeps old links working. */
export const CalendarPage = () => {
  const [searchParams] = useSearchParams();
  const next = new URLSearchParams(searchParams);
  next.set("view", "calendar");
  const query = next.toString();
  return <Navigate to={query ? `/tasks?${query}` : "/tasks?view=calendar"} replace />;
};
