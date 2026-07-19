import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHARE_IMAGE_PATH,
  DEFAULT_SHARE_SITE_NAME,
  isSocialPreviewCrawler,
  resolvePublicShareMeta,
} from "./publicShareMeta";

const origin = "https://www.nomicrm.com";

describe("resolvePublicShareMeta", () => {
  it("defaults to Sigma branding and default OG image", () => {
    const meta = resolvePublicShareMeta("/login", `${origin}/login`, {
      publicAppOrigin: origin,
    });
    expect(meta.siteName).toBe(DEFAULT_SHARE_SITE_NAME);
    expect(meta.title).toBe(DEFAULT_SHARE_SITE_NAME);
    expect(meta.imageUrl).toBe(`${origin}${DEFAULT_SHARE_IMAGE_PATH}`);
  });

  it("resolves meeting calendar short links (/c)", () => {
    const meta = resolvePublicShareMeta("/c/jkxUNJ7", `${origin}/c/jkxUNJ7`, {
      publicAppOrigin: origin,
    });
    expect(meta.title).toContain("Add to calendar");
    expect(meta.title).toContain(DEFAULT_SHARE_SITE_NAME);
    expect(meta.description.toLowerCase()).toContain("video call");
    expect(meta.imageUrl).toBe(`${origin}/og/sigma-meeting.jpg`);
  });

  it("resolves meeting calendar token links (/cal)", () => {
    const meta = resolvePublicShareMeta("/cal/abc-token", `${origin}/cal/abc-token`, {
      publicAppOrigin: origin,
    });
    expect(meta.imageUrl).toBe(`${origin}/og/sigma-meeting.jpg`);
  });

  it("resolves invoice links", () => {
    const meta = resolvePublicShareMeta("/iv/abc123", `${origin}/iv/abc123`, {
      publicAppOrigin: origin,
    });
    expect(meta.title).toContain("View & pay your invoice");
    expect(meta.imageUrl).toBe(`${origin}/og/sigma-invoice.jpg`);
  });

  it("resolves form links", () => {
    const meta = resolvePublicShareMeta("/f/xyz", `${origin}/f/xyz`, {
      publicAppOrigin: origin,
    });
    expect(meta.title).toContain("Complete your form");
    expect(meta.imageUrl).toBe(`${origin}/og/sigma-form.jpg`);
  });

  it("resolves booking links", () => {
    const meta = resolvePublicShareMeta("/b/xyz", `${origin}/b/xyz`, {
      publicAppOrigin: origin,
    });
    expect(meta.title).toContain("Book an appointment");
    expect(meta.imageUrl).toBe(`${origin}/og/sigma-booking.jpg`);
  });

  it("resolves proposal links", () => {
    const meta = resolvePublicShareMeta("/pr/xyz", `${origin}/pr/xyz`, {
      publicAppOrigin: origin,
    });
    expect(meta.title).toContain("Review your proposal");
    expect(meta.imageUrl).toBe(`${origin}/og/sigma-proposal.jpg`);
  });

  it("resolves portal links", () => {
    const meta = resolvePublicShareMeta("/p/xyz", `${origin}/p/xyz`, {
      publicAppOrigin: origin,
    });
    expect(meta.title).toContain("Client portal");
    expect(meta.imageUrl).toBe(`${origin}/og/sigma-portal.jpg`);
  });

  it("does not treat /pr as portal (/p)", () => {
    const meta = resolvePublicShareMeta("/pr/abc", `${origin}/pr/abc`, {
      publicAppOrigin: origin,
    });
    expect(meta.imageUrl).toBe(`${origin}/og/sigma-proposal.jpg`);
    expect(meta.title).toContain("Review your proposal");
  });
});

describe("isSocialPreviewCrawler", () => {
  it("detects common preview bots", () => {
    expect(isSocialPreviewCrawler("facebookexternalhit/1.1")).toBe(true);
    expect(isSocialPreviewCrawler("Applebot/0.1")).toBe(true);
    expect(isSocialPreviewCrawler("SkypeUriPreview/1.0")).toBe(true);
    expect(
      isSocialPreviewCrawler(
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      ),
    ).toBe(true);
    expect(isSocialPreviewCrawler("Mozilla/5.0 (Macintosh) Chrome/120")).toBe(
      false,
    );
  });
});
