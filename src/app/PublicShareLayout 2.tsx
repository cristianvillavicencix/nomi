import { useEffect } from "react";
import { Outlet, useLocation } from "react-router";
import {
  applyPublicShareMeta,
  readShareMetaEnv,
  resolvePublicShareMeta,
} from "@/lib/publicShareMeta";

const shareEnv = readShareMetaEnv(
  import.meta.env as Record<string, string | undefined>,
);

export const PublicShareLayout = () => {
  const location = useLocation();

  useEffect(() => {
    const pageUrl = `${window.location.origin}${location.pathname}${location.search}`;
    const meta = resolvePublicShareMeta(location.pathname, pageUrl, shareEnv);
    applyPublicShareMeta(meta);
  }, [location.pathname, location.search]);

  return <Outlet />;
};
