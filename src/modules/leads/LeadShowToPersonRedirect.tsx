import { Navigate, useParams, useSearchParams } from "react-router";
import { getContactShowPath } from "@/app/routing";

/** Legacy `/leads/:id/show` → canonical Person Full. */
export const LeadShowToPersonRedirect = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  if (!id) return <Navigate to="/accounts?view=board" replace />;
  const next = new URLSearchParams(searchParams);
  // Board stage context belongs on Accounts Board sheets, not Person Full.
  next.delete("stage");
  const query = next.toString();
  const path = getContactShowPath(id);
  return <Navigate to={query ? `${path}?${query}` : path} replace />;
};
