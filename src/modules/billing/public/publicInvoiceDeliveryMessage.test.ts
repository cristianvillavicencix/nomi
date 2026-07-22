import { describe, expect, it } from "vitest";
import {
  formatPublicInvoiceLineSubtext,
  formatPublicInvoiceLineTitle,
} from "@/modules/billing/public/publicInvoiceDeliveryMessage";

describe("public invoice line display", () => {
  it("does not expose internal line counts or duplicate address on pay page", () => {
    expect(
      formatPublicInvoiceLineSubtext(
        "Supplement for 735 Adams Ct, Throop, PA 18512, USA",
        {
          file_count: 2,
          property_address: "735 Adams Ct, Throop, PA 18512, USA",
          items: [{ kind: "supplement", line_count: 55 }],
        },
      ),
    ).toBeNull();
  });

  it("normalizes supplement title prefix", () => {
    expect(
      formatPublicInvoiceLineTitle(
        "Supplement of 735 Adams Ct, Throop, PA 18512, USA",
      ),
    ).toBe("Supplement — 735 Adams Ct, Throop, PA 18512, USA");
  });
});
