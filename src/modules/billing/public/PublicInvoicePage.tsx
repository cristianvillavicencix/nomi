import { Navigate, useParams } from "react-router";

/** Legacy `/invoice/:token` URLs redirect to the client portal invoice view. */
export const PublicInvoicePage = () => {
  const { token = "" } = useParams();
  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Invalid link
      </div>
    );
  }
  return <Navigate to={`/portal/invoice/${token}`} replace />;
};
