import { useEffect } from "react";
import { useNavigate } from "react-router";
import { NOTIFICATION_NAVIGATE_EVENT } from "@/modules/notifications/notificationNavigation";

/** SPA navigation for desktop notification clicks (avoids full page reload). */
export const NotificationNavigationListener = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const onNavigate = (event: Event) => {
      const href = (event as CustomEvent<{ href?: string }>).detail?.href;
      if (!href?.trim()) return;
      navigate(href);
    };

    window.addEventListener(NOTIFICATION_NAVIGATE_EVENT, onNavigate);
    return () =>
      window.removeEventListener(NOTIFICATION_NAVIGATE_EVENT, onNavigate);
  }, [navigate]);

  return null;
};
