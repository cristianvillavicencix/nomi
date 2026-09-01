import { assertEquals } from "jsr:@std/assert";
import {
  buildInboundTicketMessageBody,
  rewriteInlineAttachmentImages,
} from "./processTicketInbound.ts";

Deno.test("buildInboundTicketMessageBody uses plain text when present", () => {
  const result = buildInboundTicketMessageBody("Hello", null, []);
  assertEquals(result, { body: "Hello", htmlBody: null });
});

Deno.test("buildInboundTicketMessageBody accepts photo-only mail", () => {
  const attachments = [
    {
      title: "a.jpg",
      type: "image/jpeg",
      path: "a.jpg",
      src: "https://x/a.jpg",
    },
    {
      title: "b.jpg",
      type: "image/jpeg",
      path: "b.jpg",
      src: "https://x/b.jpg",
    },
  ];
  const result = buildInboundTicketMessageBody("", null, attachments);
  assertEquals(result?.body, "2 photos attached");
  assertEquals(result?.htmlBody?.includes("https://x/a.jpg"), true);
  assertEquals(result?.htmlBody?.includes("https://x/b.jpg"), true);
});

Deno.test("buildInboundTicketMessageBody rejects empty mail", () => {
  assertEquals(buildInboundTicketMessageBody("", null, []), null);
  assertEquals(buildInboundTicketMessageBody("\r\n", "  ", []), null);
});

Deno.test("rewriteInlineAttachmentImages matches Gmail filename cid references", () => {
  const attachments = [
    {
      title: "attachment1",
      type: "image/png",
      path: "0.7029766560477426",
      src: "0.7029766560477426",
      contentId: "ii_1a04a4fb68e01",
    },
    {
      title: "WhatsApp Image.jpeg",
      type: "image/jpeg",
      path: "0.7221101869527766.jpeg",
      src: "0.7221101869527766.jpeg",
      contentId: "ii_mtdhdbpi2",
    },
  ];
  const html =
    '<img src="cid:0.7221101869527766.jpeg"><img src="cid:0.7029766560477426">';
  const out = rewriteInlineAttachmentImages(html, attachments);
  assertEquals(out?.includes('src="0.7221101869527766.jpeg"'), true);
  assertEquals(out?.includes('src="0.7029766560477426"'), true);
  assertEquals(out?.includes("cid:"), false);
});
