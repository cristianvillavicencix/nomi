import { describe, expect, it } from "vitest";
import {
  buildQuotedReplyEditorHtml,
  buildQuotedReplyPlainText,
  formatQuotedReplyHeader,
} from "@/modules/tickets/ticketReplyQuotedThread";
import { createDefaultReplyHtml } from "@/modules/tickets/ticketReplyRichText";

const sampleMessage = {
  id: 1,
  ticket_id: 9,
  body: "Hello team\nPlease review.",
  html_body: null,
  from_email: "client@example.com",
  from_name: "Jose Caguana",
  created_at: "2026-06-19T14:00:00.000Z",
  direction: "inbound" as const,
};

describe("ticket reply quoted thread", () => {
  it("formats a Zoho-style quote header", () => {
    expect(formatQuotedReplyHeader(sampleMessage)).toContain("Jose Caguana");
    expect(formatQuotedReplyHeader(sampleMessage)).toContain("wrote:");
  });

  it("builds plain-text quotes with > prefixes", () => {
    const plain = buildQuotedReplyPlainText(sampleMessage);
    expect(plain).toContain("> Hello team");
    expect(plain).toContain("> Please review.");
  });

  it("places quoted HTML below the signature in the composer", () => {
    const composer = createDefaultReplyHtml(
      null,
      buildQuotedReplyEditorHtml(sampleMessage),
    );

    expect(composer.indexOf('data-ticket-reply-signature="true"')).toBeLessThan(
      composer.indexOf('data-ticket-reply-quote="true"'),
    );
    expect(composer).toContain("Jose Caguana");
  });
});
