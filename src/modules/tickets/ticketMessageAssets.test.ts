import { describe, expect, it } from "vitest";
import {
  isInlineImageCandidate,
  isInlineImageRenderedInHtml,
} from "./ticketInlineHtmlUtils";
import {
  filterDownloadableMessageAssets,
  isInlineTicketAttachment,
} from "./ticketMessageInlineAssets";
import type { MessageAsset } from "./ticketMessageAssets";

const signatureLogo: MessageAsset = {
  href: "0.abc123.png",
  path: "0.abc123.png",
  label: "image.png",
  category: "photo",
  source: "file",
  contentId: "<logo@goldline>",
};

const pdfAttachment: MessageAsset = {
  href: "0.estimate.pdf",
  path: "0.estimate.pdf",
  label: "Customer Copy.pdf",
  category: "document",
  source: "file",
  type: "application/pdf",
};

describe("isInlineTicketAttachment", () => {
  it("treats content-id images as inline", () => {
    expect(isInlineTicketAttachment(signatureLogo)).toBe(true);
  });

  it("treats photo paths referenced in html as inline", () => {
    expect(
      isInlineTicketAttachment(
        { ...signatureLogo, contentId: null },
        '<p>Thanks</p><img src="0.abc123.png" />',
      ),
    ).toBe(true);
  });

  it("keeps standalone PDFs downloadable", () => {
    expect(isInlineTicketAttachment(pdfAttachment)).toBe(false);
  });
});

describe("inline image display helpers", () => {
  it("detects unresolved cid images as missing from display html", () => {
    expect(
      isInlineImageRenderedInHtml(
        {
          title: "image.png",
          type: "image/png",
          src: "0.abc123.png",
          contentId: "<logo@goldline>",
        },
        '<p>Thanks</p><img src="cid:logo@goldline" />',
      ),
    ).toBe(false);
  });

  it("treats content-id images as inline candidates even when cid is unresolved", () => {
    expect(
      isInlineImageCandidate(
        {
          title: "image.png",
          type: "image/png",
          src: "0.abc123.png",
          contentId: "<logo@goldline>",
        },
        '<p>Thanks</p><img src="cid:logo@goldline" />',
      ),
    ).toBe(true);
  });

  it("detects appended signed images in display html", () => {
    expect(
      isInlineImageRenderedInHtml(
        {
          title: "image.png",
          type: "image/png",
          src: "0.abc123.png",
          contentId: "<logo@goldline>",
        },
        '<p>Thanks</p><img src="https://signed.example/logo.png" />',
        "https://signed.example/logo.png",
      ),
    ).toBe(true);
  });
});

describe("filterDownloadableMessageAssets", () => {
  it("hides inline signature images from the attachment bar once rendered", () => {
    const html = '<img src="https://signed.example/0.abc123.png" alt="logo" />';
    const filtered = filterDownloadableMessageAssets(
      [signatureLogo, pdfAttachment],
      html,
      html,
    );

    expect(filtered).toEqual([pdfAttachment]);
  });

  it("keeps inline images in the bar when they cannot render in html yet", () => {
    const sourceHtml = '<img src="cid:logo@goldline" alt="logo" />';
    const filtered = filterDownloadableMessageAssets(
      [signatureLogo, pdfAttachment],
      sourceHtml,
      sourceHtml,
    );

    expect(filtered).toEqual([signatureLogo, pdfAttachment]);
  });
});
