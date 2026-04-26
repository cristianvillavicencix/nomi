import { Navigate } from "react-router";

/** Users are managed only under Settings; old /sales routes redirect here. */
export const RedirectToSettingsUsers = () => (
  <Navigate
    to={{ pathname: "/settings", search: "?section=users" }}
    replace
  />
);
