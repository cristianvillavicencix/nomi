/** Browser/OS desktop notifications (messages, tickets, tasks, leads). */

export type DesktopNotificationSupport =
  | "unsupported"
  | "default"
  | "granted"
  | "denied";

export const getDesktopNotificationSupport = (): DesktopNotificationSupport => {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return "unsupported";
  }
  const permission = Notification.permission as DesktopNotificationSupport;
  if (
    permission === "default" ||
    permission === "denied" ||
    permission === "granted"
  ) {
    return permission;
  }
  return "unsupported";
};

export async function requestDesktopNotifications(): Promise<DesktopNotificationSupport> {
  if (typeof Notification === "undefined") {
    return "unsupported";
  }
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    const next = await Notification.requestPermission();
    return next === "granted"
      ? "granted"
      : next === "denied"
        ? "denied"
        : "default";
  } catch {
    return "denied";
  }
}

export const showDesktopNotification = ({
  title,
  body,
  tag,
  onClick,
}: {
  title: string;
  body: string;
  tag: string;
  onClick?: () => void;
}) => {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return;
  }
  if (Notification.permission !== "granted") return;

  try {
    const notification = new Notification(title, {
      body,
      tag: `nomi-${tag}`,
      requireInteraction: false,
    });
    notification.onclick = () => {
      try {
        window.focus();
        onClick?.();
      } catch {
        /* ignore */
      }
      notification.close();
    };
  } catch {
    /* ignore e.g. iOS Safari */
  }
};

// Backward-compatible aliases for messaging module
export type MessagingDesktopSupport = DesktopNotificationSupport;
export const getMessagingDesktopSupport = getDesktopNotificationSupport;
export const requestMessagingDesktopNotifications = requestDesktopNotifications;
export const showMessagingDesktopNotification = showDesktopNotification;
