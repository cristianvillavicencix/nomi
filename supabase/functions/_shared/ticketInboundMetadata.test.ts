import { assertEquals } from "jsr:@std/assert";
import {
  detectCompanyCamInbound,
  extractPropertyAddressFromSubject,
} from "./ticketInboundMetadata.ts";

Deno.test("extractPropertyAddressFromSubject parses CompanyCam-style subject", () => {
  const subject =
    "4202 WELDON DR, GARLAND, TX 75043_CompanyCam Report";
  assertEquals(extractPropertyAddressFromSubject(subject), "4202 WELDON DR");
});

Deno.test("detectCompanyCamInbound tags and normalizes subject", () => {
  const result = detectCompanyCamInbound({
    headers: [{ Name: "X-CM-Envelope", Value: "abc" }],
    subject: "4202 WELDON DR, GARLAND, TX 75043_CompanyCam Report",
    fromEmail: "reports@companycam.com",
  });

  assertEquals(result.isCompanyCam, true);
  assertEquals(result.tags, ["companycam"]);
  assertEquals(result.propertyAddress, "4202 WELDON DR");
  assertEquals(result.normalizedSubject, "4202 WELDON DR");
});

Deno.test("detectCompanyCamInbound ignores regular mail", () => {
  const result = detectCompanyCamInbound({
    headers: [],
    subject: "Question about my roof",
    fromEmail: "homeowner@example.com",
  });

  assertEquals(result.isCompanyCam, false);
  assertEquals(result.tags, []);
  assertEquals(result.normalizedSubject, "Question about my roof");
});
