import { describe, expect, it } from "vitest";
import { formatWorkerError } from "../../../supabase/functions/_shared/formatWorkerError.ts";

describe("formatWorkerError", () => {
  it("maps HTML 522 pages to a short message", () => {
    const html = "<!DOCTYPE html><html>Error code 522</html>";
    expect(formatWorkerError(html, 522)).toBe(
      "IMAP worker unreachable (timeout). Check MAIL_IMAP_WORKER_URL.",
    );
  });

  it("extracts JSON error bodies", () => {
    expect(formatWorkerError('{"error":"SMTP connection failed"}')).toBe(
      "SMTP connection failed",
    );
  });
});
