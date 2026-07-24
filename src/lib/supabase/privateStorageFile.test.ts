import { afterEach, describe, expect, it, vi } from "vitest";
import {
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
});
