import { describe, expect, it } from "vitest";
import type { ClientInvoice, TicketDeliverable } from "@/modules/types";
import { buildTicketInvoiceSendEmailPreviews } from "@/modules/tickets/ticketInvoicePreview";

const draftInvoice = {
  id: 1,
  invoice_number: "INV-2026-0024",
  amount: 62.1,
  issue_date: "2026-06-23",
  due_date: "2026-06-30",
} as ClientInvoice;

const deliverables = [
  { id: 1, title: "Roof report.pdf", invoiced_invoice_id: null },
  { id: 2, title: "ESX file.esx", invoiced_invoice_id: 99 },
] as TicketDeliverable[];

describe("buildTicketInvoiceSendEmailPreviews", () => {
  it("builds payment, sms, and delivery previews with unbilled files only", () => {
    const previews = buildTicketInvoiceSendEmailPreviews({
      draftInvoice,
      paymentUrl: "https://pay.example/inv",
      organizationName: "LBS",
      emailMessage: "Please pay using the secure link below.",
      serviceLines: ["11 Whitney Lane"],
      propertyAddress: "11 Whitney Lane, West Haven, CT",
      deliverables,
      contactFirstName: "Genesis",
    });

    expect(previews.amountFormatted).toContain("62");
    expect(previews.fileCount).toBe(1);
    expect(previews.paymentEmailHtml).toContain("INV-2026-0024");
    expect(previews.paymentEmailHtml).toContain("Pay securely");
    expect(previews.paymentSmsText).toContain("https://pay.example/inv");
    expect(previews.deliveryEmailHtml).toContain("Roof report.pdf");
    expect(previews.deliveryEmailHtml).not.toContain("ESX file.esx");
  });

  it("returns empty previews when invoice or payment url is missing", () => {
    const previews = buildTicketInvoiceSendEmailPreviews({
      draftInvoice: null,
      paymentUrl: "",
      organizationName: "LBS",
      emailMessage: "",
      serviceLines: [],
      propertyAddress: "Property",
      deliverables: [],
    });

    expect(previews.paymentEmailHtml).toBe("");
    expect(previews.paymentSmsText).toBe("");
    expect(previews.deliveryEmailHtml).toBe("");
    expect(previews.fileCount).toBe(0);
  });
});
