import { describe, expect, it } from "vitest";
import { sanitizeMailHtml } from "./sanitizeMailHtml";

const XSS_PAYLOADS = [
  `<script>alert(1)</script><p>Hello</p>`,
  `<img src=x onerror="alert(1)">`,
  `<a href="javascript:alert(1)">click</a>`,
  `<p style="background:url(javascript:alert(1))">x</p>`,
];

describe("sanitizeMailHtml XSS payloads", () => {
  it.each(XSS_PAYLOADS)("strips executable markup from %s", (html) => {
    const out = sanitizeMailHtml(html);
    expect(out.toLowerCase()).not.toContain("<script");
    expect(out.toLowerCase()).not.toContain("onerror=");
    expect(out.toLowerCase()).not.toContain("javascript:");
  });
});
