export type InvoiceSendHistoryKind =
  | "invoice_sent"
  | "payment_reminder"
  | "payment_receipt"
  | "payment_receipt_sms"
  | "other";

export const invoiceSendHistoryKind = (emailType?: string | null) => {
  if (emailType === "payment_reminder") return "payment_reminder" as const;
  if (emailType === "payment_receipt") return "payment_receipt" as const;
  if (emailType === "payment_receipt_sms") return "payment_receipt_sms" as const;
  if (emailType === "invoice_sent") return "invoice_sent" as const;
  return "other" as const;
};

export const invoiceSendHistoryChannel = (kind: InvoiceSendHistoryKind) =>
  kind === "payment_receipt_sms" ? "SMS" : "Email";

const reminderKindLabel = (referenceKey?: string | null) => {
  const key = String(referenceKey ?? "");
  if (key.endsWith(":overdue")) return "Overdue reminder";
  if (key.endsWith(":due_today")) return "Due today reminder";
  if (key.endsWith(":upcoming_1d")) return "1-day reminder";
  if (key.endsWith(":upcoming_3d")) return "3-day reminder";
  return "Payment reminder";
};

export const invoiceSendHistoryLabel = (params: {
  emailType?: string | null;
  referenceKey?: string | null;
}) => {
  const kind = invoiceSendHistoryKind(params.emailType);
  if (kind === "payment_reminder") {
    return reminderKindLabel(params.referenceKey);
  }
  if (kind === "payment_receipt") return "Payment receipt";
  if (kind === "payment_receipt_sms") return "Payment receipt";
  if (kind === "invoice_sent") return "Invoice sent";
  return "Notification";
};

export const invoiceSendHistoryStatusLabel = (status?: string | null) => {
  if (status === "failed") return "Failed";
  if (status === "skipped") return "Skipped";
  return "Sent";
};
