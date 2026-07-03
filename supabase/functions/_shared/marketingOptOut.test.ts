import { describe, expect, it } from "vitest";
import {
  appendSmsStopFooter,
  isSmsOptOutMessage,
} from "./marketingOptOut.ts";

describe("isSmsOptOutMessage", () => {
  it("detects STOP keywords", () => {
    expect(isSmsOptOutMessage("STOP")).toBe(true);
    expect(isSmsOptOutMessage("stop")).toBe(true);
    expect(isSmsOptOutMessage("Unsubscribe")).toBe(true);
    expect(isSmsOptOutMessage("  CANCEL  ")).toBe(true);
  });

  it("ignores normal messages", () => {
    expect(isSmsOptOutMessage("Please stop by tomorrow")).toBe(false);
    expect(isSmsOptOutMessage("Thanks!")).toBe(false);
  });
});

describe("appendSmsStopFooter", () => {
  it("appends footer when missing", () => {
    expect(appendSmsStopFooter("Hello")).toBe(
      "Hello\n\nReply STOP to opt out.",
    );
  });

  it("does not duplicate footer", () => {
    expect(appendSmsStopFooter("Hello\n\nReply STOP to opt out.")).toBe(
      "Hello\n\nReply STOP to opt out.",
    );
  });
});
