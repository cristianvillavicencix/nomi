import { afterEach, describe, expect, it, vi } from "vitest";
import {
  blobForInlinePreview,
  openPrivateStorageFile,
  resolvePrivateStorageLocation,
  sanitizePrivateStorageFilename,
} from "./privateStorageFile";

vi.mock("@/components/atomic-crm/providers/supabase/supabase", () => ({
  supabase: {
    storage: {
      from: () => ({
        createSignedUrl: vi.fn(),
      }),
    },
  },
}));

describe("privateStorageFile", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sanitizes unsafe filename characters", () => {
    expect(sanitizePrivateStorageFilename('bad/name:"test".pdf')).toBe(
      "bad-name--test-.pdf",
    );
    expect(sanitizePrivateStorageFilename("")).toBe("file");
  });

  it("forces application/pdf on preview blobs", () => {
    const octet = new Blob(["%PDF"], { type: "application/octet-stream" });
    expect(blobForInlinePreview(octet, "quote.pdf").type).toBe("application/pdf");

    const typed = new Blob(["%PDF"], { type: "application/pdf" });
    expect(blobForInlinePreview(typed, "quote.pdf")).toBe(typed);

    const byMime = new Blob(["%PDF"], { type: "application/pdf;charset=utf-8" });
    expect(blobForInlinePreview(byMime, "file.bin").type).toBe("application/pdf");

    const docx = new Blob(["PK"], { type: "" });
    expect(blobForInlinePreview(docx, "letter.docx").type).toBe("");
  });

  it("parses bucket/path locations", () => {
    expect(
      resolvePrivateStorageLocation({
        bucket: "mail-attachments",
        path: "3/5/277/file.pdf",
      }),
    ).toEqual({
      bucket: "mail-attachments",
      path: "3/5/277/file.pdf",
      filename: undefined,
      expiresIn: undefined,
    });
  });

  it("parses storage path references with default bucket", () => {
    expect(
      resolvePrivateStorageLocation({
        reference: "3/5/277/file.pdf",
        defaultBucket: "mail-attachments",
      }),
    ).toEqual({
      bucket: "mail-attachments",
      path: "3/5/277/file.pdf",
      filename: undefined,
      expiresIn: undefined,
    });
  });

  it("returns null for external http references", () => {
    expect(
      resolvePrivateStorageLocation({
        reference: "https://www.nomicrm.com/files/abc123",
      }),
    ).toBeNull();
  });

  it("parses legacy Supabase public storage URLs", () => {
    expect(
      resolvePrivateStorageLocation({
        reference:
          "https://qjglkywmqwqdoaboakao.supabase.co/storage/v1/object/public/attachments/0de761ae-364c-4577-b4f5-58a013f755ec.pdf",
      }),
    ).toEqual({
      bucket: "attachments",
      path: "0de761ae-364c-4577-b4f5-58a013f755ec.pdf",
      filename: undefined,
      expiresIn: undefined,
    });
  });

  it("parses bare attachment paths with default bucket", () => {
    expect(
      resolvePrivateStorageLocation({
        reference: "0de761ae-364c-4577-b4f5-58a013f755ec.pdf",
        defaultBucket: "attachments",
      }),
    ).toEqual({
      bucket: "attachments",
      path: "0de761ae-364c-4577-b4f5-58a013f755ec.pdf",
      filename: undefined,
      expiresIn: undefined,
    });
  });

  it("opens a preview tab immediately and streams the PDF url", async () => {
    const write = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const previewTab = {
      document: {
        open: vi.fn(),
        write,
        close: vi.fn(),
      },
      location: { replace: vi.fn() },
      close: vi.fn(),
      opener: {},
    } as unknown as Window;
    const open = vi.spyOn(window, "open").mockReturnValue(previewTab);

    await openPrivateStorageFile({
      reference: "https://example.com/quote.pdf",
      filename: "quote.pdf",
    });

    expect(open).toHaveBeenCalledWith("about:blank", "_blank");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(
      write.mock.calls.some((call) =>
        String(call[0]).includes("https://example.com/quote.pdf"),
      ),
    ).toBe(true);
  });
});
