export const NOTIFICATION_NAVIGATE_EVENT = "nomi:notification-navigate";

export const navigateToNotificationHref = (href: string) => {
  if (typeof window === "undefined" || !href.trim()) return;
  window.dispatchEvent(
    new CustomEvent(NOTIFICATION_NAVIGATE_EVENT, {
      detail: { href: href.trim() },
    }),
  );
};
