import { describe, expect, it } from "vitest";
import type { Deal } from "@/components/atomic-crm/types";
import { pickPreferredDeal } from "@/modules/proposals/proposalClientSearch";

const deal = (id: number, overrides: Partial<Deal> = {}): Deal =>
  ({
    id,
    name: `Deal ${id}`,
    company_id: 1,
    contact_ids: [],
    ...overrides,
  }) as Deal;

describe("pickPreferredDeal", () => {
  it("prefers a deal linked to the selected contact", () => {
    const deals = [
      deal(1, { contact_id: 10 }),
      deal(2, { contact_ids: [99] }),
    ];
    expect(pickPreferredDeal(deals, 10)?.id).toBe(1);
  });

  it("falls back to the first deal when none match the contact", () => {
    const deals = [deal(5), deal(6)];
    expect(pickPreferredDeal(deals, 42)?.id).toBe(5);
  });

  it("returns null when there are no deals", () => {
    expect(pickPreferredDeal([], 1)).toBeNull();
  });
});
