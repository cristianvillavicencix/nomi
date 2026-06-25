import { Navigate, useLocation } from "react-router";

/** Deprecated full-page create — opens the pipeline lead dialog on the list. */
export const LeadCreatePage = () => {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  params.set("create", "lead");
  return <Navigate to={`/leads?${params.toString()}`} replace />;
};
