import { describe, expect, it } from "vitest";
import type { Company } from "../../types";
import { getCompanyAvatar, getCompanyFaviconSources } from "./getCompanyAvatar";

it("should return favicon URL if website url exist", async () => {
  const website = "https://example.com";
  const record: Partial<Company> = { website };

  const avatarUrl = await getCompanyAvatar(record);
  expect(avatarUrl).toStrictEqual({
    src: "https://www.google.com/s2/favicons?domain=example.com&sz=64",
    title: "Company favicon",
  });
});

it("should return null if no website is provided", async () => {
  const record: Partial<Company> = {};

  const avatarUrl = await getCompanyAvatar(record);
  expect(avatarUrl).toBeNull();
});

it("should rewrite legacy DuckDuckGo logo src using the company website", () => {
  const record: Partial<Company> = {
    website: "https://abccontractorllc.net",
    logo: {
      src: "https://icons.duckduckgo.com/ip3/abccontractorllc.net.ico",
      title: "Company favicon",
    },
  };

  expect(getCompanyFaviconSources(record)).toEqual([
    "https://www.google.com/s2/favicons?domain=abccontractorllc.net&sz=64",
  ]);
});
