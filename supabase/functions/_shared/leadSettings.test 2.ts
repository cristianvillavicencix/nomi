import { describe, expect, it } from "vitest";
import {
  normalizeOrganizationLeadSettings,
  shouldCreateDealFromWebLead,
} from "./leadSettings.ts";

describe("normalizeOrganizationLeadSettings", () => {
  it("defaults to pipeline-only inbound leads", () => {
    expect(normalizeOrganizationLeadSettings(null)).toEqual({
      auto_create_deal_from_web: false,
      allow_form_auto_create_deal: false,
    });
  });
});

describe("shouldCreateDealFromWebLead", () => {
  it("does not create deals when workspace setting is off", () => {
    expect(
      shouldCreateDealFromWebLead(
        {
          auto_create_deal_from_web: false,
          allow_form_auto_create_deal: false,
        },
        { source: "lbs-unlock", toolKey: "google-audit" },
      ),
    ).toBe(false);
  });

  it("creates deals for tool leads when workspace setting is on", () => {
    expect(
      shouldCreateDealFromWebLead(
        {
          auto_create_deal_from_web: true,
          allow_form_auto_create_deal: false,
        },
        { source: "lbs-unlock", toolKey: "google-audit" },
      ),
    ).toBe(true);
  });
});
