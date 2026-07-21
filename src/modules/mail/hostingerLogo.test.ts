import { describe, expect, it } from "vitest";
import {
  HOSTINGER_LOGO_DATA_URI,
  rewriteHostingerLogoImagesInHtml,
} from "./hostingerLogo";

describe("hostingerLogo", () => {
  it("rewrites hostinger.com logo URLs to embedded SVG data URI", () => {
    const html =
      '<img src="https://www.hostinger.com/logo-400x400.png" alt="Hostinger logo" width="80" />';
    const out = rewriteHostingerLogoImagesInHtml(html);
    expect(out).toContain(HOSTINGER_LOGO_DATA_URI);
    expect(out).not.toContain("logo-400x400.png");
    expect(out).toContain('alt="Hostinger logo"');
  });

  it("leaves unrelated images unchanged", () => {
    const html = '<img src="https://example.com/photo.jpg" alt="Photo" />';
    expect(rewriteHostingerLogoImagesInHtml(html)).toBe(html);
  });
});
