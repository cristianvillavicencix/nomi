import { describe, expect, it, vi } from "vitest";
import type { FileAttachment } from "@/lib/fileAttachments";
import { resolveTicketDisplayHtml } from "./ticketInlineHtml";

vi.mock("@/lib/supabase/privateStorageFile", () => ({
  resolvePrivateStorageSignedUrl: vi.fn(
    async (input: { reference?: string }) =>
      input.reference
        ? `https://signed.test/${input.reference}`
        : null,
  ),
}));

/** Gmail-style inbound: HTML cid uses storage filename, not MIME Content-ID. */
const unitedProAttachments: FileAttachment[] = [
  {
    title: "attachment1",
    type: "image/png",
    path: "0.7029766560477426",
    src: "0.7029766560477426",
    contentId: "ii_1a04a4fb68e01",
  },
  {
    title: "WhatsApp Image 2026-08-28 at 4.34.56 PM.jpeg",
    type: "image/jpeg",
    path: "0.7221101869527766.jpeg",
    src: "0.7221101869527766.jpeg",
    contentId: "ii_mtdhdbpi2",
  },
];

const unitedProHtml = `<div><img src="cid:0.7221101869527766.jpeg" alt="WhatsApp"><table><tr><td><img src="cid:0.7029766560477426" width="142"></td></tr></table></div>`;

describe("resolveTicketDisplayHtml", () => {
  it("rewrites Gmail filename-style cid references to signed URLs", async () => {
    const out = await resolveTicketDisplayHtml(
      unitedProHtml,
      unitedProAttachments,
    );
    expect(out).toContain("https://signed.test/0.7221101869527766.jpeg");
    expect(out).toContain("https://signed.test/0.7029766560477426");
    expect(out).not.toMatch(/cid:/i);
  });
});
