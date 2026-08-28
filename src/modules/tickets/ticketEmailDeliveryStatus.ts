import type { TicketMessage } from "@/modules/types";
import { formatTicketMessageTime } from "@/modules/tickets/ticketInboxUi";

export type TicketEmailDeliveryContext = {
  replyDurationLabel?: string | null;
};

const formatRecipientList = (emails?: string[] | null) => {
  const list = (emails ?? []).map((email) => email.trim()).filter(Boolean);
  if (!list.length) return null;
  return list.join(", ");
};

const buildDeliveryDetail = (
  message: TicketMessage,
  context?: TicketEmailDeliveryContext,
  extra?: string,
) => {
  const parts = [
    message.created_at
      ? `Sent ${formatTicketMessageTime(message.created_at)}`
      : null,
    (() => {
      const to = formatRecipientList(message.to_emails);
      return to ? `To: ${to}` : null;
    })(),
    context?.replyDurationLabel,
    extra,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : undefined;
};

export type TicketEmailDeliveryStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "undelivered"
  | "failed"
  | "skipped";

export type TicketEmailDeliveryDisplay = {
  label: string;
  tone: "success" | "pending" | "warning" | "error" | "muted";
  detail?: string;
};

const ERROR_HINTS: Record<string, string> = {
  "30007": "Blocked by carrier (spam filter)",
  "30006": "Number cannot receive SMS",
  "30005": "Carrier rejected the message",
};

const normalizeStatus = (
  raw: string | null | undefined,
): TicketEmailDeliveryStatus | null => {
  const value = raw?.trim().toLowerCase();
  if (!value) return null;
  if (
    value === "queued" ||
    value === "sent" ||
    value === "delivered" ||
    value === "undelivered" ||
    value === "failed" ||
    value === "skipped"
  ) {
    return value;
  }
  return null;
};

export const getTicketEmailDeliveryDisplay = (
  message: TicketMessage,
  context?: TicketEmailDeliveryContext,
): TicketEmailDeliveryDisplay | null => {
  if (message.direction === "internal" || message.direction === "inbound") {
    return null;
  }
  if (message.direction !== "outbound") return null;

  const status = normalizeStatus(message.email_delivery_status);
  if (!status) {
    return message.external_message_id
      ? {
          label: "Sent",
          tone: "pending",
          detail: buildDeliveryDetail(message, context),
        }
      : null;
  }

  const errorCode = message.email_error_code?.trim() || null;
  const errorHint = errorCode ? ERROR_HINTS[errorCode] : undefined;

  switch (status) {
    case "delivered":
      return {
        label: "Delivered",
        tone: "success",
        detail: buildDeliveryDetail(message, context),
      };
    case "queued":
      return {
        label: "Sending…",
        tone: "pending",
        detail: buildDeliveryDetail(message, context),
      };
    case "sent":
      return {
        label: "Sent",
        tone: "pending",
        detail: buildDeliveryDetail(message, context),
      };
    case "skipped":
      return {
        label: "Not emailed",
        tone: "muted",
        detail: buildDeliveryDetail(message, context),
      };
    case "undelivered":
      return {
        label: "Not delivered",
        tone: "error",
        detail: buildDeliveryDetail(
          message,
          context,
          errorHint ?? (errorCode ? `Error ${errorCode}` : undefined),
        ),
      };
    case "failed":
      return {
        label: "Failed",
        tone: "error",
        detail: buildDeliveryDetail(
          message,
          context,
          errorHint ?? (errorCode ? `Error ${errorCode}` : undefined),
        ),
      };
    default:
      return {
        label: "Sent",
        tone: "pending",
        detail: buildDeliveryDetail(message, context),
      };
  }
};

export const emailDeliveryToneClassName = (
  tone: TicketEmailDeliveryDisplay["tone"],
) => {
  switch (tone) {
    case "success":
      return "text-emerald-600 dark:text-emerald-400";
    case "pending":
      return "text-amber-600 dark:text-amber-400";
    case "warning":
      return "text-orange-600 dark:text-orange-400";
    case "error":
      return "text-destructive";
    default:
      return "text-muted-foreground";
  }
};
