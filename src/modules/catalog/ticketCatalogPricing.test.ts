import { describe, expect, it } from "vitest";
import {
  buildTicketCatalogPricingLine,
  slugifyTicketBillingSlug,
} from "@/modules/catalog/ticketCatalogPricing";

describe("ticketCatalogPricing", () => {
  it("slugifies product names", () => {
    expect(slugifyTicketBillingSlug("Weather Report")).toBe("weather_report");
  });

  it("uses flat catalog price", () => {
    const line = buildTicketCatalogPricingLine(
      {
        billing_kind: "weather_report",
        service_package_id: 9,
      },
      "205 S Third Ave",
      [
        {
          id: 9,
          name: "Weather Report",
          suggested_price: 30,
          ticket_billing_slug: "weather_report",
          ticket_pricing_mode: "flat",
        },
      ],
    );

    expect(line?.lineTotal).toBe(30);
    expect(line?.description).toContain("Weather Report");
  });
});
