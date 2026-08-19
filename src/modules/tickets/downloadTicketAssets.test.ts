import { describe, expect, it, vi } from "vitest";
import type { MessageAsset } from "./ticketMessageAssets";
import { isPreviewablePdfAsset } from "./downloadTicketAssets";

vi.mock("@/components/atomic-crm/providers/supabase/supabase", () => ({
  supabase: {
    storage: {
      from: () => ({
        createSignedUrl: vi.fn(),
      }),
    },
  },
}));

const pdf: MessageAsset = {
  href: "0.estimate.pdf",
  path: "0.estimate.pdf",
  label: "Pinos Lety WD Final.pdf",
  category: "document",
  source: "file",
  type: "application/pdf",
};

describe("isPreviewablePdfAsset", () => {
  it("treats PDF files as previewable", () => {
    expect(isPreviewablePdfAsset(pdf)).toBe(true);
  });

  it("does not preview Word files", () => {
    expect(
      isPreviewablePdfAsset({
        ...pdf,
        label: "letter.docx",
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        href: "0.letter.docx",
      }),
    ).toBe(false);
  });
});
