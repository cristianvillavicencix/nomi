/**
 * Mail render pipeline tests (jsdom for DOMPurify).
 */
import { describe, expect, it } from "vitest";
import { buildMailIframeSrcDoc } from "./mailIframeDocument";
import {
  analyzeMailRenderPipeline,
  type MailRenderDebugReport,
} from "./mailRenderDebug";
import { MAIL_RENDER_FIXTURES } from "./mailRenderFixtures";
import { HOSTINGER_LOGO_DATA_URI } from "./hostingerLogo";
import { sanitizeMailHtmlParts, sanitizeEmailCss } from "./sanitizeMailHtml";

describe("mail render pipeline", () => {
  it("preserves Google Fonts @import in extracted CSS", () => {
    const raw = MAIL_RENDER_FIXTURES.googleNewsletter;
    const { emailStyles } = sanitizeMailHtmlParts(raw);
    expect(emailStyles).toMatch(/fonts\.googleapis\.com|Roboto/i);
  });

  it("strips nested @media blocks that hide desktop_only", () => {
    const css = `@media only screen and (max-width: 810px) and (orientation:portrait){
.desktop_only { display: none; height: 0px; }
.mobile_only { display: table!important; }
.outer { width:100% !important; }
}`;
    const out = sanitizeEmailCss(css);
    expect(out).not.toMatch(/\.desktop_only\s*\{[^}]*display\s*:\s*none/);
    expect(out).toContain(".mobile_only{display:none!important;}");
  });

  it("injects allowed stylesheet link into srcdoc head", () => {
    const srcdoc = buildMailIframeSrcDoc(MAIL_RENDER_FIXTURES.googleNewsletter);
    expect(srcdoc).toContain('rel="stylesheet"');
    expect(srcdoc).toContain("fonts.googleapis.com");
    expect(srcdoc).toContain("mail-reader-shell");
    expect(srcdoc).toContain("mail-body-root");
    expect(srcdoc).toContain('name="viewport" content="width=680"');
  });

  it("keeps CTA table markup after sanitize", () => {
    const { body } = sanitizeMailHtmlParts(MAIL_RENDER_FIXTURES.googleNewsletter);
    expect(body).toContain("Hacer una contribución");
    expect(body).toContain("<table");
    expect(body).not.toContain("<script");
  });

  it("maps nested body to mail-nested-body for forwards", () => {
    const { body } = sanitizeMailHtmlParts(MAIL_RENDER_FIXTURES.forwardedNested);
    expect(body).toContain("mail-body-root");
    expect(body).toContain("mail-nested-body");
    expect(body).toContain("Forwarded message");
  });

  it("strips cid images but keeps https images", () => {
    const { body } = sanitizeMailHtmlParts(MAIL_RENDER_FIXTURES.inlineImages);
    expect(body).not.toContain("cid:");
    expect(body).toContain("https://example.com/logo.png");
  });

  it("analyzeMailRenderPipeline flags stripped stylesheet hosts", () => {
    const report = analyzeMailRenderPipeline(
      MAIL_RENDER_FIXTURES.externalFontLink,
    );
    expect(report.styleLinkCountAllowed).toBeGreaterThan(0);
    expect(report.warnings.some((w) => w.code === "stylesheet_host_blocked")).toBe(
      true,
    );
  });

  it("sender CSS is ordered after shell in srcdoc", () => {
    const srcdoc = buildMailIframeSrcDoc(MAIL_RENDER_FIXTURES.googleNewsletter);
    const shellIdx = srcdoc.indexOf("mail-reader-shell");
    const senderMarker = srcdoc.indexOf(".cta-button");
    expect(shellIdx).toBeGreaterThan(-1);
    expect(senderMarker).toBeGreaterThan(shellIdx);
  });

  it("forces responsive image rules after sender CSS", () => {
    const srcdoc = buildMailIframeSrcDoc(MAIL_RENDER_FIXTURES.googleNewsletter);
    const senderMarker = srcdoc.indexOf(".cta-button");
    const imgGuard = srcdoc.indexOf("max-height: 480px !important");
    expect(imgGuard).toBeGreaterThan(senderMarker);
  });

  it("clamps oversized svg logos and hero images", () => {
    const { body } = sanitizeMailHtmlParts(MAIL_RENDER_FIXTURES.oversizedSvgLogo);
    expect(body).toContain("<svg");
    expect(body).toMatch(/width="680"/);
    expect(body).toMatch(/width="680"|max-width:\s*100%/);
    const srcdoc = buildMailIframeSrcDoc(MAIL_RENDER_FIXTURES.oversizedSvgLogo);
    expect(srcdoc).toContain("max-height: 480px !important");
    expect(srcdoc).toContain("mail-body-root svg");
  });

  it("embeds Hostinger logo SVG for transactional emails", () => {
    const srcdoc = buildMailIframeSrcDoc(
      MAIL_RENDER_FIXTURES.hostingerTransactional,
    );
    expect(srcdoc).toContain(HOSTINGER_LOGO_DATA_URI);
    expect(srcdoc).not.toContain("logo-400x400.png");
  });

  it("adds reader padding and paragraph spacing for zero-margin Apple Mail HTML", () => {
    const srcdoc = buildMailIframeSrcDoc(MAIL_RENDER_FIXTURES.appleMailPlain);
    expect(srcdoc).toContain("padding: 16px 16px 32px");
    expect(srcdoc).toContain("margin-block: 0 0.85em !important");
  });
});

describe("mail render fixtures sanity", () => {
  it("each fixture produces a non-empty debug report", () => {
    for (const fixture of Object.values(MAIL_RENDER_FIXTURES)) {
      const report: MailRenderDebugReport = analyzeMailRenderPipeline(fixture);
      expect(report.rawBytes).toBeGreaterThan(0);
      expect(report.sanitizedBodyBytes).toBeGreaterThan(0);
    }
  });
});
