import { useEffect } from "react";
import { useLocation } from "react-router";

import { markTicketNotificationsRead } from "@/modules/notifications/notificationHistory";

const isTicketsRoute = (pathname: string) =>
  pathname === "/tickets" || pathname.startsWith("/tickets/");

export const useMarkTicketNotificationsReadOnVisit = () => {
  const location = useLocation();

  useEffect(() => {
    if (!isTicketsRoute(location.pathname)) return;
    markTicketNotificationsRead();
  }, [location.pathname]);
};
