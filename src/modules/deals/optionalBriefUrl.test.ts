import { describe, expect, it } from "vitest";
import { optionalBriefUrl } from "./websiteBriefEditorShared";

describe("optionalBriefUrl", () => {
  it("accepts bare domains, www, and https", () => {
    expect(optionalBriefUrl("example.com")).toBeUndefined();
    expect(optionalBriefUrl("www.example.com")).toBeUndefined();
    expect(optionalBriefUrl("https://example.com")).toBeUndefined();
    expect(optionalBriefUrl("http://www.example.com/path")).toBeUndefined();
  });

  it("rejects empty-looking junk", () => {
    expect(optionalBriefUrl("not a url")).toBeTruthy();
  });
});
