import { assertEquals } from "jsr:@std/assert";
import { buildInboundTicketMessageBody } from "./processTicketInbound.ts";

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
