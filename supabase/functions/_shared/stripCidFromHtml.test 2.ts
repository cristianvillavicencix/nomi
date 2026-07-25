import { describe, expect, it } from "vitest";
import { stripCidFromHtml } from "./stripCidFromHtml.ts";

describe("stripCidFromHtml", () => {
  it("removes img tags with cid src", () => {
    const html =
      '<p>Hi</p><img src="cid:0a326807-3740-4db7-8eec-f7ba7e9c080e" alt="logo">';
    expect(stripCidFromHtml(html)).toBe("<p>Hi</p>");
  });

  it("clears standalone cid src attributes", () => {
    const html = '<div style="background-image:url(cid:abc@host)">x</div>';
    expect(stripCidFromHtml(html)).not.toContain("cid:");
  });
});
