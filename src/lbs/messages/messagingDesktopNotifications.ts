/** Browser/OS desktop notifications for new messages (any tab / minimized window). */

export type MessagingDesktopSupport = "unsupported" | "default" | "granted" | "denied";

export const getMessagingDesktopSupport = (): MessagingDesktopSupport => {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return "unsupported";
  }
  const p = Notification.permission as MessagingDesktopSupport;
  if (p === "default" || p === "denied" || p === "granted") return p;
  return "unsupported";
};

export async function requestMessagingDesktopNotifications(): Promise<MessagingDesktopSupport> {
  if (typeof Notification === "undefined") {
    return "unsupported";
  }
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    const next = await Notification.requestPermission();
    return next === "granted" ? "granted" : next === "denied" ? "denied" : "default";
  } catch {
    return "denied";
  }
}

/** Fire-and-forget; only runs if user previously granted Permission. */
export const showMessagingDesktopNotification = ({
  title,
  body,
  tag,
}: {
  title: string;
  body: string;
  tag: string;
}) => {
  if (typeof window === "undefined" || typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, {
      body,
      tag: `nomi-msg-${tag}`,
      requireInteraction: false,
    });
    n.onclick = () => {
      try {
        window.focus();
      } catch {
        /* ignore */
      }
      n.close();
    };
  } catch {
    /* ignore e.g. iOS Safari */
  }
};
