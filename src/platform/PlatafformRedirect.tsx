import { Navigate, useLocation } from "react-router";

/** URL mal escrita `.../platafform/...` → `.../sas/...` */
export const PlatafformToSasRedirect = () => {
  const { pathname, search, hash } = useLocation();
  const to = `${pathname.split("/platafform").join("/sas")}${search}${hash}`;
  return <Navigate to={to} replace />;
};

/** Ruta legada `.../platform/...` (sin uso; la consola es solo `/sas`) → `.../sas/...` */
export const OldPlatformToSasRedirect = () => {
  const { pathname, search, hash } = useLocation();
  const to = `${pathname.split("/platform").join("/sas")}${search}${hash}`;
  return <Navigate to={to} replace />;
};
