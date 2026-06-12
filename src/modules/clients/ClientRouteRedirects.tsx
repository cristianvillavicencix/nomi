import { Navigate, useParams, useSearchParams } from "react-router";
import {
  getClientEditPath,
  getClientShowPath,
  getCompaniesListPath,
  getContactsListPath,
} from "@/app/routing";

/** `/clients` with optional legacy query params → new list routes. */
export const LegacyClientsListRedirect = () => {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab");
  const create = searchParams.get("create");

  const next = new URLSearchParams();
  if (create === "company" || create === "contact") {
    next.set("create", create);
  }

  const query = next.toString();
  const base = tab === "contacts" ? getContactsListPath() : getCompaniesListPath();
  return <Navigate to={`${base}${query ? `?${query}` : ""}`} replace />;
};

/** `/clients/:id/show` → `/companies/:id` */
export const LegacyClientShowRedirect = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();

  if (!id) {
    return <Navigate to={getCompaniesListPath()} replace />;
  }

  const query = searchParams.toString();
  return (
    <Navigate
      to={`${getClientShowPath(id)}${query ? `?${query}` : ""}`}
      replace
    />
  );
};

/** `/clients/:id` (no suffix) → `/companies/:id` */
export const LegacyClientIdRedirect = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();

  if (!id) {
    return <Navigate to={getCompaniesListPath()} replace />;
  }

  const query = searchParams.toString();
  return (
    <Navigate
      to={`${getClientShowPath(id)}${query ? `?${query}` : ""}`}
      replace
    />
  );
};

/** `/clients/:id/edit` → company profile with edit dialog */
export const LegacyClientEditRedirect = () => {
  const { id } = useParams();

  if (!id) {
    return <Navigate to={getCompaniesListPath()} replace />;
  }

  return <Navigate to={getClientEditPath(id)} replace />;
};
