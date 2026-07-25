import { describe, expect, it } from "vitest";
import {
  normalizeContentId,
  rewriteCidReferencesInHtml,
} from "./mailInlineImages.ts";

describe("mailInlineImages (edge shared)", () => {
  it("matches partial content ids", () => {
    const html = '<img src="cid:logo@local.example" />';
    const map = new Map([["logo@local", "https://example.com/logo.png"]]);
    const out = rewriteCidReferencesInHtml(html, map);
    expect(out).toContain("https://example.com/logo.png");
  });

  it("normalizes angle brackets", () => {
    expect(normalizeContentId("<image001@01DABC>")).toBe("image001@01dabc");
  });
});
