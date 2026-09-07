import { describe, expect, it } from "vitest";
import { sanitizeTicketEmailHtml } from "./sanitizeTicketEmailHtml";

const XSS_PAYLOADS = [
  `<script>alert(1)</script><p>Hello</p>`,
  `<img src=x onerror="alert(1)">`,
  `<iframe src="https://evil.example"></iframe><p>ok</p>`,
  `<a href="javascript:alert(1)">click</a>`,
];

describe("sanitizeTicketEmailHtml XSS payloads", () => {
  it.each(XSS_PAYLOADS)("strips executable markup from %s", (html) => {
    const out = sanitizeTicketEmailHtml(html);
    expect(out.toLowerCase()).not.toContain("<script");
    expect(out.toLowerCase()).not.toContain("onerror=");
    expect(out.toLowerCase()).not.toContain("<iframe");
    expect(out.toLowerCase()).not.toContain("javascript:");
  });
});
