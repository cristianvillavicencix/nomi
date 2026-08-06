import { describe, expect, it } from "vitest";
import { buildPublicFormRedirectPath } from "@/modules/forms/public/ShortUrlRedirect";

describe("buildPublicFormRedirectPath", () => {
  it("preserves query string from short link", () => {
    const token = "a".repeat(64);
    expect(
      buildPublicFormRedirectPath(
        token,
        "?sections=service%3Acarpentry&services=Carpentry",
      ),
    ).toBe(
      `/forms/${token}?sections=service%3Acarpentry&services=Carpentry`,
    );
  });

  it("works without query string", () => {
    const token = "b".repeat(64);
    expect(buildPublicFormRedirectPath(token, "")).toBe(`/forms/${token}`);
  });
});
