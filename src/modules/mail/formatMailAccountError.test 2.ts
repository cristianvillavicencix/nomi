import { describe, expect, it } from "vitest";
import { formatMailAccountError } from "./formatMailAccountError";

describe("formatMailAccountError", () => {
  it("maps Cloudflare 522 HTML to a short message", () => {
    const html =
      '<!DOCTYPE html><html><title>onrender.com | 522: Connection timed out</title></html>';
    expect(formatMailAccountError(html)).toBe(
      "IMAP worker unreachable (timeout). Check MAIL_IMAP_WORKER_URL.",
    );
  });

  it("strips HTML tags from plain error strings", () => {
    expect(formatMailAccountError("<b>Sync failed</b>")).toBe("Sync failed");
  });
});
