import { describe, expect, it } from "vitest";
import {
  buildTicketPaymentCopyFromDeliverables,
  resolveTicketSmsServiceSubject,
} from "@/modules/tickets/ticketInvoiceCopy";

describe("ticketInvoiceCopy", () => {
  it("builds copy for a known billing kind", () => {
    const copy = buildTicketPaymentCopyFromDeliverables(
      [{ billing_kind: "supplement", billing_line_count: 50 }],
      "57 Marwick",
    );

    expect(copy.subject).toBe("Invoice for supplement (57 Marwick)");
    expect(copy.message).toContain("Your Xactimate supplement is ready.");
  });

  it("falls back for catalog billing kinds without crashing", () => {
    const copy = buildTicketPaymentCopyFromDeliverables(
      [{ billing_kind: "weather_report" }],
      "57 Marwick",
    );

    expect(copy.subject).toBe("Invoice for weather report (57 Marwick)");
    expect(copy.message).toContain("Your weather report is ready.");
    expect(copy.deliverySubject).toBe(
      "Your weather report files are ready (57 Marwick)",
    );
  });

  it("falls back SMS subject for unknown billing kinds", () => {
    expect(
      resolveTicketSmsServiceSubject([{ billing_kind: "weather_report" }]),
    ).toBe("weather report");
  });
});
