import { Navigate, useSearchParams } from "react-router";
import { getAccountsHubPath } from "@/app/routing";

/** `/leads` list → Accounts Board (preserve query e.g. create=lead). */
export const LeadsListToAccountsRedirect = () => {
  const [searchParams] = useSearchParams();
  const next = new URLSearchParams(searchParams);
  next.set("view", "board");
  const query = next.toString();
  return (
    <Navigate
      to={query ? `/accounts?${query}` : getAccountsHubPath("board")}
      replace
    />
  );
};

/** `/clients` → Accounts List (preserve tab/create query). */
export const ClientsHubToAccountsRedirect = () => {
  const [searchParams] = useSearchParams();
  const next = new URLSearchParams(searchParams);
  next.delete("view");
  const tab = next.get("tab");
  if (tab === "contacts") next.set("tab", "people");
  const query = next.toString();
  const base = getAccountsHubPath("list");
  if (!query) return <Navigate to={base} replace />;
  return <Navigate to={`/accounts?${query}`} replace />;
};

/** `/companies` or `/contacts` list → Accounts List (preserve create/tab). */
export const ListAliasToAccountsRedirect = () => {
  const [searchParams] = useSearchParams();
  const next = new URLSearchParams(searchParams);
  next.delete("view");
  const tab = next.get("tab");
  if (tab === "contacts") next.set("tab", "people");
  const query = next.toString();
  return (
    <Navigate to={query ? `/accounts?${query}` : "/accounts"} replace />
  );
};
