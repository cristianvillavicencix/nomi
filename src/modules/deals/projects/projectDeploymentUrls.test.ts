import { describe, expect, it } from "vitest";
import {
  deploymentUrlPatchFromBrief,
  getBriefProductionUrl,
  resolveProjectDeploymentUrls,
} from "./projectDeploymentUrls";

describe("projectDeploymentUrls", () => {
  it("falls back to brief existing_website for production", () => {
    const resolved = resolveProjectDeploymentUrls({
      production_url: null,
      staging_url: null,
      website_brief: { existing_website: "https://latsportteam.com" },
    });

    expect(resolved.productionUrl).toBe("https://latsportteam.com");
    expect(resolved.productionFromBrief).toBe(true);
  });

  it("prefers deal production_url over brief", () => {
    const resolved = resolveProjectDeploymentUrls({
      production_url: "https://live.example.com",
      staging_url: null,
      website_brief: { existing_website: "https://old.example.com" },
    });

    expect(resolved.productionUrl).toBe("https://live.example.com");
    expect(resolved.productionFromBrief).toBe(false);
  });

  it("builds production url from brief domain", () => {
    expect(getBriefProductionUrl({ domain: "latsportteam.com" })).toBe(
      "https://latsportteam.com",
    );
  });

  it("syncs empty deal columns from brief on save", () => {
    const patch = deploymentUrlPatchFromBrief(
      { production_url: null, staging_url: null },
      {
        existing_website: "latsportteam.com",
        staging_url: "https://staging.latsportteam.com",
      },
    );

    expect(patch.production_url).toBe("https://latsportteam.com");
    expect(patch.staging_url).toBe("https://staging.latsportteam.com");
  });
});
