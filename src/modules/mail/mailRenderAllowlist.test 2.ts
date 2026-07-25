import { describe, expect, it } from "vitest";
import {
  isAllowedEmailCssImport,
  isAllowedEmailStylesheet,
  listBlockedStylesheetHrefs,
} from "./mailRenderAllowlist";

describe("mailRenderAllowlist", () => {
  it("allows Google Fonts", () => {
    expect(
      isAllowedEmailStylesheet(
        "https://fonts.googleapis.com/css2?family=Roboto",
      ),
    ).toBe(true);
  });

  it("allows Adobe Typekit", () => {
    expect(isAllowedEmailStylesheet("https://use.typekit.net/abc123.css")).toBe(
      true,
    );
  });

  it("allows Mailchimp CDN", () => {
    expect(
      isAllowedEmailStylesheet("https://chimpstatic.com/css/1.0/email.css"),
    ).toBe(true);
  });

  it("allows click.email.* ESP stylesheet hosts", () => {
    expect(
      isAllowedEmailStylesheet(
        "https://click.email.raymourflanigan.com/css/email.css",
      ),
    ).toBe(true);
  });

  it("allows Salesforce Marketing Cloud suffix", () => {
    expect(
      isAllowedEmailStylesheet(
        "https://images.example.exacttarget.com/styles.css",
      ),
    ).toBe(true);
  });

  it("blocks unknown hosts", () => {
    expect(
      isAllowedEmailStylesheet("https://evil.example.com/steal.css"),
    ).toBe(false);
  });

  it("allows @import for allowlisted hosts", () => {
    expect(
      isAllowedEmailCssImport(
        "url(https://fonts.googleapis.com/css?family=Open+Sans)",
      ),
    ).toBe(true);
  });

  it("lists blocked hrefs from HTML", () => {
    const html = `<link rel="stylesheet" href="https://fonts.googleapis.com/css" />
<link rel="stylesheet" href="https://bad.test/style.css" />`;
    expect(listBlockedStylesheetHrefs(html)).toEqual([
      "https://bad.test/style.css",
    ]);
  });
});
