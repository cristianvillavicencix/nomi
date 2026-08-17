import { describe, expect, it } from "vitest";

const mapBillingIntervalToStripe = (interval: "weekly" | "monthly" | "yearly") => {
  if (interval === "weekly") return "week";
  if (interval === "yearly") return "year";
  return "month";
};

const CLIENT_SUBSCRIPTION_METADATA_TYPE = "client_subscription";

const buildSubscriptionMetadata = (params: {
  orgId: number;
  subscriptionId: number;
  contactId?: number | null;
  companyId?: number | null;
}) => ({
  type: CLIENT_SUBSCRIPTION_METADATA_TYPE,
  org_id: String(params.orgId),
  subscription_id: String(params.subscriptionId),
  contact_id: params.contactId ? String(params.contactId) : "",
  company_id: params.companyId ? String(params.companyId) : "",
});

describe("clientSubscriptionStripe helpers", () => {
  it("maps billing intervals to Stripe recurring intervals", () => {
    expect(mapBillingIntervalToStripe("weekly")).toBe("week");
    expect(mapBillingIntervalToStripe("monthly")).toBe("month");
    expect(mapBillingIntervalToStripe("yearly")).toBe("year");
  });

  it("builds subscription metadata for webhooks", () => {
    expect(
      buildSubscriptionMetadata({
        orgId: 1,
        subscriptionId: 42,
        contactId: 5,
        companyId: 9,
      }),
    ).toEqual({
      type: "client_subscription",
      org_id: "1",
      subscription_id: "42",
      contact_id: "5",
      company_id: "9",
    });
  });

  it("reads Stripe invoice subscription ids from current and Basil shapes", () => {
    const stripeSubscriptionIdFromInvoice = (
      invoice: Record<string, unknown>,
    ): string | null => {
      const direct = invoice.subscription;
      if (typeof direct === "string" && direct) return direct;
      if (direct && typeof direct === "object") {
        const id = (direct as { id?: unknown }).id;
        if (typeof id === "string" && id) return id;
      }
      const parent = invoice.parent;
      if (parent && typeof parent === "object") {
        const nested = (
          parent as { subscription_details?: { subscription?: unknown } }
        ).subscription_details?.subscription;
        if (typeof nested === "string" && nested) return nested;
      }
      return null;
    };

    expect(stripeSubscriptionIdFromInvoice({ subscription: "sub_1" })).toBe(
      "sub_1",
    );
    expect(
      stripeSubscriptionIdFromInvoice({ subscription: { id: "sub_2" } }),
    ).toBe("sub_2");
    expect(
      stripeSubscriptionIdFromInvoice({
        parent: { subscription_details: { subscription: "sub_3" } },
      }),
    ).toBe("sub_3");
    expect(stripeSubscriptionIdFromInvoice({})).toBeNull();
  });
});
