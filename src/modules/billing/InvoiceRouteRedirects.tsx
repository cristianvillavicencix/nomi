import { Navigate, useParams } from "react-router";

/** Legacy full-page invoice URLs → billing workspace with sidebar selection. */
export const InvoiceWorkspaceRedirect = () => {
  const { id = "" } = useParams();
  if (!id) return <Navigate to="/billing" replace />;
  return <Navigate to={`/billing?invoice=${encodeURIComponent(id)}`} replace />;
};
