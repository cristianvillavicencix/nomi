import { describe, expect, it } from "vitest";
import {
  buildSubscriptionAgreementPdfFilename,
  buildSubscriptionReceiptPdfFilename,
  stripAgreementMarkdownToPlain,
} from "@/modules/billing/subscriptions/subscriptionAgreementClientPdf";

describe("subscriptionAgreementClientPdf", () => {
  it("builds stable download filenames from subscription numbers", () => {
    expect(buildSubscriptionAgreementPdfFilename("SUB-2026-0004")).toBe(
      "subscription-agreement-SUB-2026-0004.pdf",
    );
    expect(buildSubscriptionReceiptPdfFilename("SUB 2026/0004")).toBe(
      "subscription-receipt-SUB-2026-0004.pdf",
    );
  });

  it("strips markdown and HTML to plain text for PDF body", () => {
    const plain = stripAgreementMarkdownToPlain(
      "# Title\n\n**Bold** and *italic*\n\n<img src=\"x\" />\n\n- One\n- Two",
    );
    expect(plain).toContain("Title");
    expect(plain).toContain("Bold");
    expect(plain).toContain("italic");
    expect(plain).toContain("• One");
    expect(plain).not.toContain("<img");
    expect(plain).not.toContain("**");
  });
});
