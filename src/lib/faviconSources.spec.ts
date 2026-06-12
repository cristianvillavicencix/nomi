import { describe, expect, it } from "vitest";
import {
  expandFaviconSources,
  extractDomainFromStoredFaviconUrl,
  getFaviconSourcesForWebsite,
  isLegacyStoredFaviconUrl,
} from "./faviconSources";

describe("extractDomainFromStoredFaviconUrl", () => {
  it("strips DuckDuckGo .ico suffix from stored logo URLs", () => {
    expect(
      extractDomainFromStoredFaviconUrl(
        "https://icons.duckduckgo.com/ip3/aj-constructionme.com.ico",
      ),
    ).toBe("aj-constructionme.com");
  });

  it("reads domain from gstatic faviconV2 url param", () => {
    expect(
      extractDomainFromStoredFaviconUrl(
        "https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&url=http://goldenkeyroof.com&size=64",
      ),
    ).toBe("goldenkeyroof.com");
  });
});

describe("expandFaviconSources", () => {
  it("rewrites legacy DuckDuckGo logo src to Google S2", () => {
    expect(
      expandFaviconSources([
        "https://icons.duckduckgo.com/ip3/abccontractorllc.net.ico",
      ]),
    ).toEqual([
      "https://www.google.com/s2/favicons?domain=abccontractorllc.net&sz=64",
    ]);
  });

  it("falls back to website when logo src is empty", () => {
    expect(expandFaviconSources([], "https://example.com")).toEqual(
      getFaviconSourcesForWebsite("https://example.com"),
    );
  });
});

describe("isLegacyStoredFaviconUrl", () => {
  it("detects DuckDuckGo and gstatic stored favicons", () => {
    expect(
      isLegacyStoredFaviconUrl(
        "https://icons.duckduckgo.com/ip3/example.com.ico",
      ),
    ).toBe(true);
    expect(
      isLegacyStoredFaviconUrl(
        "https://t1.gstatic.com/faviconV2?url=http://example.com",
      ),
    ).toBe(true);
    expect(isLegacyStoredFaviconUrl("https://cdn.example.com/logo.png")).toBe(
      false,
    );
  });
});
