import { describe, expect, it } from "vitest";
import {
  parseSkippedAttachmentsNote,
  stripSkippedAttachmentsNote,
} from "@/modules/tickets/parseSkippedAttachmentsNote";

const SAMPLE = `Gracias,

Priscilla C.

---
Skipped attachments:
- attachment11 (0 B, attachment count limit)
- attachment12 (0 B, attachment count limit)
- attachment28 (0 B, attachment count limit)`;

describe("parseSkippedAttachmentsNote", () => {
  it("parses skipped attachment lines and strips them from the body", () => {
    const parsed = parseSkippedAttachmentsNote(SAMPLE);
    expect(parsed?.count).toBe(3);
    expect(parsed?.lines[0]).toEqual({
      title: "attachment11",
      sizeLabel: "0 B",
      reason: "attachment count limit",
    });
    expect(parsed?.contentWithoutNote).toContain("Priscilla C.");
    expect(parsed?.contentWithoutNote).not.toContain("Skipped attachments");
  });

  it("strips HTML variants with <br/>", () => {
    const html = `Thanks<br/>---<br/>Skipped attachments:<br/>- photo.png (2 MB, limit 25 MB)<br/>`;
    expect(stripSkippedAttachmentsNote(html)).toBe("Thanks");
    expect(parseSkippedAttachmentsNote(html)?.count).toBe(1);
  });
});
