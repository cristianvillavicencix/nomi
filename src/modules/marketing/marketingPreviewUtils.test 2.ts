import { describe, expect, it } from "vitest";
import {
  appendSmsStopFooter,
  getSmsSegmentInfo,
  textToMarketingEmailHtml,
} from "./marketingPreviewUtils";

describe("appendSmsStopFooter", () => {
  it("appends compliance footer", () => {
    expect(appendSmsStopFooter("Hello")).toContain("Reply STOP to opt out.");
  });
});

describe("getSmsSegmentInfo", () => {
  it("counts segments", () => {
    expect(getSmsSegmentInfo("x".repeat(161)).segments).toBe(2);
  });
});

describe("textToMarketingEmailHtml", () => {
  it("wraps paragraphs", () => {
    expect(textToMarketingEmailHtml("Line one\n\nLine two")).toContain("<p");
  });
});
