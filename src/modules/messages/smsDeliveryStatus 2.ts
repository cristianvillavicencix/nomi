import type { ConversationMessage } from "@/modules/types";

export type SmsDeliveryStatus =
  | "queued"
  | "sending"
  | "sent"
  | "delivered"
  | "undelivered"
  | "failed"
  | "canceled";

export type SmsDeliveryDisplay = {
  label: string;
  tone: "success" | "pending" | "warning" | "error" | "muted";
  detail?: string;
};

const TWILIO_ERROR_HINTS: Record<string, string> = {
  "30007": "Blocked by carrier (spam filter)",
  "30006": "Number cannot receive SMS",
  "30005": "Carrier rejected the message",
  "30003": "Unreachable handset",
  "21211": "Invalid phone number",
};

const normalizeStatus = (
  raw: string | null | undefined,
): SmsDeliveryStatus | null => {
  const value = raw?.trim().toLowerCase();
  if (!value) return null;
  if (
    value === "queued" ||
    value === "sending" ||
    value === "sent" ||
    value === "delivered" ||
    value === "undelivered" ||
    value === "failed" ||
    value === "canceled"
  ) {
    return value;
  }
  return null;
};

export const isSmsDeliveryRetryable = (message: ConversationMessage) => {
  if (message.direction !== "outbound" || message.is_internal_note) {
    return false;
  }
  if (!message.external_id) {
    return false;
  }
  const status = normalizeStatus(message.sms_delivery_status);
  return status === "undelivered" || status === "failed";
};

export const getSmsDeliveryDisplay = (
  message: ConversationMessage,
): SmsDeliveryDisplay | null => {
  if (message.direction !== "outbound" || message.is_internal_note) {
    return null;
  }
  if (!message.external_id) {
    return null;
  }

  const status = normalizeStatus(message.sms_delivery_status) ?? "sent";
  const errorCode = message.sms_error_code?.trim() || null;
  const errorHint = errorCode ? TWILIO_ERROR_HINTS[errorCode] : undefined;

  switch (status) {
    case "delivered":
      return { label: "Delivered", tone: "success" };
    case "queued":
    case "sending":
      return { label: "Sending…", tone: "pending" };
    case "sent":
      return { label: "Sent", tone: "pending" };
    case "undelivered":
      return {
        label: "Not delivered",
        tone: "error",
        detail: errorHint ?? (errorCode ? `Error ${errorCode}` : undefined),
      };
    case "failed":
      return {
        label: "Failed",
        tone: "error",
        detail: errorHint ?? (errorCode ? `Error ${errorCode}` : undefined),
      };
    case "canceled":
      return { label: "Canceled", tone: "muted" };
    default:
      return { label: "Sent", tone: "pending" };
  }
};

export const smsDeliveryToneClassName = (tone: SmsDeliveryDisplay["tone"]) => {
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
