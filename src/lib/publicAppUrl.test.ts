import { describe, expect, it } from "vitest";
import {
  DEFAULT_PUBLIC_APP_URL,
  resolvePublicAppBaseUrl,
  resolveSubscriptionSetupShareUrl,
} from "@/lib/publicAppUrl";

describe("publicAppUrl", () => {
  it("prefers configured public app URL over localhost share links", () => {
    const url = resolveSubscriptionSetupShareUrl({
      setup_share_url: "http://localhost:5174/sub/JZn58uy",
      setup_short_code: "JZn58uy",
    });

    expect(url).toBe(`${DEFAULT_PUBLIC_APP_URL}/sub/JZn58uy`);
    expect(url).not.toContain("localhost");
  });

  it("falls back to production origin outside dev", () => {
    expect(resolvePublicAppBaseUrl()).toBe(DEFAULT_PUBLIC_APP_URL);
  });
});
