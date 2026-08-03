import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { buildInvoiceSmsText } from "@/modules/billing/invoiceEmailTemplate";
import {
  buildTicketPaymentReminderSmsText,
  buildTicketPaymentSmsText,
} from "@/modules/tickets/ticketInvoiceCopy";
import {
  messageBodyHasHiddenFinancialDetails,
  sanitizeMessageBodyForFinancialAccess,
} from "@/lib/permissions/messageFinancialSanitizer";

describe("sanitizeMessageBodyForFinancialAccess", () => {
  it("returns body unchanged when user can view amounts", () => {
    const body =
      "Your invoice INV-2026-0060 is ready — $1,345.11 due August 19, 2026.\nPay: https://www.nomicrm.com/iv/RZWvfcx?pay=1";
    assert.equal(sanitizeMessageBodyForFinancialAccess(body, true), body);
  });

  it("redacts invoice SMS template content for restricted users", () => {
    const body = [
      "Hi Manuel,",
      "Latino Business Support here:",
      "Your invoice INV-2026-0060 is ready — $1,345.11 due August 19, 2026.",
      "Pay: https://www.nomicrm.com/iv/RZWvfcx?pay=1",
      "",
      "Thank you for your trust.",
    ].join("\n");

    const sanitized = sanitizeMessageBodyForFinancialAccess(body, false);

    assert.match(sanitized, /Hi Manuel,/);
    assert.doesNotMatch(sanitized, /\$1,345\.11/);
    assert.doesNotMatch(sanitized, /INV-2026-0060/);
    assert.doesNotMatch(sanitized, /nomicrm\.com\/iv\//);
    assert.match(sanitized, /Pay: \[hidden\]/);
    assert.match(sanitized, /Thank you for your trust\./);
  });

  it("redacts buildInvoiceSmsText output", () => {
    const body = buildInvoiceSmsText({
      invoice: {
        id: 1,
        invoice_number: "INV-2026-0060",
        amount: 1345.11,
        amount_paid: 0,
        currency: "USD",
        due_date: "2026-08-19",
      },
      organizationName: "Latino Business Support",
      paymentUrl: "https://www.nomicrm.com/iv/RZWvfcx?pay=1",
      contact: { id: 1, first_name: "Manuel", last_name: "Alvares" },
    });

    const sanitized = sanitizeMessageBodyForFinancialAccess(body, false);
    assert.doesNotMatch(sanitized, /\$1,345\.11/);
    assert.doesNotMatch(sanitized, /INV-2026-0060/);
    assert.match(sanitized, /Pay: \[hidden\]/);
  });

  it("redacts ticket payment SMS templates", () => {
    const payBody = buildTicketPaymentSmsText({
      orgName: "Latino Business Support",
      paymentUrl: "https://www.nomicrm.com/iv/abc123?pay=1",
      recipientFirstName: "Manuel",
      serviceSubject: "roof report",
    });
    const reminderBody = buildTicketPaymentReminderSmsText({
      orgName: "Latino Business Support",
      paymentUrl: "https://www.nomicrm.com/iv/abc123?pay=1",
      recipientFirstName: "Manuel",
      serviceSubject: "roof report",
    });

    const sanitizedPay = sanitizeMessageBodyForFinancialAccess(payBody, false);
    const sanitizedReminder = sanitizeMessageBodyForFinancialAccess(
      reminderBody,
      false,
    );

    assert.match(sanitizedPay, /Pay here \[payment link hidden\]/);
    assert.match(sanitizedReminder, /Pay here \[payment link hidden\]/);
    assert.doesNotMatch(sanitizedPay, /nomicrm\.com\/iv\//);
  });

  it("detects when financial details were hidden", () => {
    const body = "Invoice INV-2026-0060 — $500.00";
    assert.equal(messageBodyHasHiddenFinancialDetails(body, true), false);
    assert.equal(messageBodyHasHiddenFinancialDetails(body, false), true);
    assert.equal(
      messageBodyHasHiddenFinancialDetails("Hello there", false),
      false,
    );
  });
});
