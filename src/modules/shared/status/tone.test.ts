import { describe, expect, it } from "vitest";
import { TONE_HEX, toneBadgeVariant, toneClass } from "./tone";

describe("toneClass", () => {
  it("is the only map from tone to Tailwind color classes", () => {
    expect(toneClass("success", "solid")).toContain("bg-success");
    expect(toneClass("destructive", "solid")).toContain("bg-destructive");
    expect(toneClass("info", "text")).toContain("text-info");
    expect(toneClass("muted", "dot")).toContain("bg-muted-foreground");
  });

  it("maps tones onto Badge variants", () => {
    expect(toneBadgeVariant("success")).toBe("success");
    expect(toneBadgeVariant("muted")).toBe("outline");
    expect(toneBadgeVariant("brand")).toBe("default");
  });

  it("exports print hex derived from the same tokens", () => {
    expect(TONE_HEX.brand).toMatch(/^#/);
    expect(TONE_HEX.muted).toBe("#64748b");
  });
});
