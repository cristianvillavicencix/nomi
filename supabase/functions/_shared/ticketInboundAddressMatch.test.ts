import { assertEquals } from "jsr:@std/assert";
import { normalizeStreetAddress } from "./ticketInboundAddressMatch.ts";

Deno.test("normalizeStreetAddress collapses punctuation and spacing", () => {
  assertEquals(
    normalizeStreetAddress("4202 WELDON DR, Garland, TX"),
    "4202 weldon dr garland tx",
  );
});
