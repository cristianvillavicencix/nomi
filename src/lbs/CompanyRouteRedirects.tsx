import { Navigate, useParams, useSearchParams } from "react-router";

/** Legacy /companies/* → LBS /clients/* */
export const CompanyToClientShowRedirect = () => {
  const { id, tab } = useParams();
  const [searchParams] = useSearchParams();

  if (!id) {
    return <Navigate to="/clients" replace />;
  }

  const nextSearchParams = new URLSearchParams(searchParams);
  if (tab) {
    nextSearchParams.set("tab", tab);
  }

  const query = nextSearchParams.toString();
  return (
    <Navigate
      to={`/clients/${id}/show${query ? `?${query}` : ""}`}
      replace
    />
  );
};

export const CompanyToClientEditRedirect = () => {
  const { id } = useParams();

  if (!id) {
    return <Navigate to="/clients" replace />;
  }

  return <Navigate to={`/clients/${id}/edit`} replace />;
};
