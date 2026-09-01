import { describe, expect, it } from "vitest";
import {
  isLegacyAddonLine,
  isPackageLine,
  packageAlreadyInCart,
  primaryOneTimePackageLine,
  selectedPackageId,
} from "./proposalCatalogUtils";
import type { ProposalLineDraft } from "./proposalCommercialUtils";

const line = (partial: Partial<ProposalLineDraft>): ProposalLineDraft => ({
  key: partial.key ?? "k1",
  description: partial.description ?? "Item",
  quantity: partial.quantity ?? 1,
  unit_price: partial.unit_price ?? 100,
  billing_type: partial.billing_type ?? "one_time",
  billing_interval: partial.billing_interval ?? null,
  package_id: partial.package_id ?? null,
  addon_id: partial.addon_id ?? null,
  sort_order: partial.sort_order ?? 0,
});

describe("proposalCatalogUtils", () => {
  it("treats package_id lines as catalog lines", () => {
    expect(isPackageLine(line({ package_id: 5 }))).toBe(true);
    expect(isLegacyAddonLine(line({ addon_id: 3 }))).toBe(true);
    expect(
      isLegacyAddonLine(line({ addon_id: 3, package_id: 9 })),
    ).toBe(false);
  });

  it("allows multiple package lines in cart", () => {
    const lines = [
      line({ key: "a", package_id: 1, billing_type: "one_time" }),
      line({ key: "b", package_id: 2, billing_type: "recurring" }),
    ];
    expect(packageAlreadyInCart(lines, 1)).toBe(true);
    expect(packageAlreadyInCart(lines, 3)).toBe(false);
  });

  it("picks first one-time package as primary for deck preset", () => {
    const lines = [
      line({ key: "r", package_id: 2, billing_type: "recurring" }),
      line({ key: "o", package_id: 1, billing_type: "one_time" }),
    ];
    expect(primaryOneTimePackageLine(lines)?.key).toBe("o");
    expect(selectedPackageId(lines)).toBe(1);
  });
});
