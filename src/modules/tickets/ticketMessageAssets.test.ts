import { describe, expect, it } from "vitest";
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

describe("filterDownloadableMessageAssets", () => {
  it("hides inline signature images from the attachment bar", () => {
    const html = '<img src="0.abc123.png" alt="logo" />';
    const filtered = filterDownloadableMessageAssets(
      [signatureLogo, pdfAttachment],
      html,
    );

    expect(filtered).toEqual([pdfAttachment]);
  });
});
