import { describe, expect, it } from "vitest";
import {
  invoiceSendHistoryChannel,
  invoiceSendHistoryKind,
  invoiceSendHistoryLabel,
  invoiceSendHistoryStatusLabel,
} from "@/modules/billing/invoiceSendHistory";

describe("invoice send history labels", () => {
  it("maps reminder kinds from the reference key", () => {
    expect(
      invoiceSendHistoryLabel({
        emailType: "payment_reminder",
        referenceKey: "reminder:2026-09-01:overdue",
      }),
    ).toBe("Overdue reminder");
    expect(
      invoiceSendHistoryLabel({
        emailType: "payment_reminder",
        referenceKey: "reminder:2026-09-01:upcoming_3d",
      }),
    ).toBe("3-day reminder");
  });

  it("separates email vs SMS receipt logs", () => {
    expect(invoiceSendHistoryKind("payment_receipt_sms")).toBe(
      "payment_receipt_sms",
    );
    expect(invoiceSendHistoryChannel("payment_receipt_sms")).toBe("SMS");
    expect(invoiceSendHistoryChannel("payment_receipt")).toBe("Email");
  });

  it("labels delivery status", () => {
    expect(invoiceSendHistoryStatusLabel("sent")).toBe("Sent");
    expect(invoiceSendHistoryStatusLabel("failed")).toBe("Failed");
    expect(invoiceSendHistoryStatusLabel("skipped")).toBe("Skipped");
  });
});
