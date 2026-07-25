import { describe, expect, it } from "vitest";
import {
  normalizeContentId,
  rewriteCidReferencesInHtml,
} from "./mailInlineImages";

describe("mailInlineImages", () => {
  it("normalizes Content-ID values", () => {
    expect(normalizeContentId("<logo@local>")).toBe("logo@local");
    expect(normalizeContentId("cid:ABC@host")).toBe("abc@host");
  });

  it("rewrites cid img src to signed URLs", () => {
    const html =
      '<p>Hi</p><img src="cid:0a326807-3740-4db7-8eec-f7ba7e9c080e" alt="logo">';
    const map = new Map([
      [
        "0a326807-3740-4db7-8eec-f7ba7e9c080e",
        "https://cdn.example/signed/logo.png",
      ],
    ]);
    const out = rewriteCidReferencesInHtml(html, map);
    expect(out).toContain("https://cdn.example/signed/logo.png");
    expect(out).not.toContain("cid:");
  });

  it("rewrites background url(cid:...) references", () => {
    const html =
      '<div style="background-image:url(cid:hero@mail)">x</div>';
    const map = new Map([["hero@mail", "https://cdn.example/signed/hero.png"]]);
    const out = rewriteCidReferencesInHtml(html, map);
    expect(out).toContain("https://cdn.example/signed/hero.png");
    expect(out).not.toContain("cid:");
  });
});
