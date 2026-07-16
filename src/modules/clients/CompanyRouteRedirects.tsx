import { Navigate, useParams, useSearchParams } from "react-router";
import {
  getClientCreatePath,
  getClientEditPath,
  getClientShowPath,
  getCompaniesListPath,
} from "@/app/routing";

/** Legacy `/companies/:id/show` → `/companies/:id` */
export const LegacyCompanyShowRedirect = () => {
  const { id, tab } = useParams();
  const [searchParams] = useSearchParams();

  if (!id) {
    return <Navigate to={getCompaniesListPath()} replace />;
  }

  const nextSearchParams = new URLSearchParams(searchParams);
  if (tab) {
    nextSearchParams.set("tab", tab);
  }

  const query = nextSearchParams.toString();
  return (
    <Navigate
      to={`${getClientShowPath(id)}${query ? `?${query}` : ""}`}
      replace
    />
  );
};

export const LegacyCompanyEditRedirect = () => {
  const { id } = useParams();

  if (!id) {
    return <Navigate to={getCompaniesListPath()} replace />;
  }

  return <Navigate to={getClientEditPath(id)} replace />;
};

/** Legacy `/companies/create` → open new-company dialog on list */
export const LegacyCompanyCreateRedirect = () => (
  <Navigate to={getClientCreatePath()} replace />
);
