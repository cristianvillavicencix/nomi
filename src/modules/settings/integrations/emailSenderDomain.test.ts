import { describe, expect, it } from "vitest";

import {
  isAllowedOrgEmailAddress,
  validateOrgSenderEmail,
} from "@/modules/settings/integrations/emailSenderDomain";

describe("emailSenderDomain", () => {
  it("accepts lbs.bz addresses", () => {
    expect(isAllowedOrgEmailAddress("info@lbs.bz")).toBe(true);
    expect(isAllowedOrgEmailAddress("billing@lbs.bz")).toBe(true);
    expect(isAllowedOrgEmailAddress("supplements@lbs.bz")).toBe(true);
  });

  it("rejects other domains", () => {
    expect(isAllowedOrgEmailAddress("info@gmail.com")).toBe(false);
    expect(isAllowedOrgEmailAddress("user@other.lbs.bz.evil.com")).toBe(false);
  });

  it("validates sender input", () => {
    expect(validateOrgSenderEmail("")).toBe("Email is required");
    expect(validateOrgSenderEmail("not-an-email")).toBe(
      "Enter a valid email address",
    );
    expect(validateOrgSenderEmail("info@gmail.com")).toBe(
      "Use an @lbs.bz address",
    );
    expect(validateOrgSenderEmail("info@lbs.bz")).toBeNull();
  });
});
