import { describe, expect, it } from "vitest";
import {
  buildProjectDeliveryAnalysis,
  formatDeliveryAnalysisBlockerMessage,
  hasBlockingDeliveryAnalysis,
} from "./projectDeliveryAnalysis";

describe("buildProjectDeliveryAnalysis", () => {
  it("marks ready project as mostly ok", () => {
    const items = buildProjectDeliveryAnalysis({
      briefPercent: 100,
      productionUrl: "https://example.com",
      credentialsCount: 3,
      pendingChecklistCount: 0,
      resourcesCount: 8,
      hasPortalAccount: true,
      hasLinkedContact: true,
    });

    expect(items.find((item) => item.id === "brief")?.status).toBe("ok");
    expect(items.find((item) => item.id === "launch_checklist")?.status).toBe(
      "ok",
    );
    expect(hasBlockingDeliveryAnalysis(items)).toBe(false);
  });

  it("flags missing contact and production url as blocking", () => {
    const items = buildProjectDeliveryAnalysis({
      briefPercent: 40,
      productionUrl: "",
      credentialsCount: 0,
      pendingChecklistCount: 2,
      pendingChecklistLabels: ["SSL certificate", "Analytics tag"],
      resourcesCount: 0,
      hasPortalAccount: false,
      hasLinkedContact: false,
    });

    expect(hasBlockingDeliveryAnalysis(items)).toBe(true);
    expect(items.find((item) => item.id === "portal")?.status).toBe("error");
    expect(items.find((item) => item.id === "production_url")?.status).toBe(
      "error",
    );
    expect(items.find((item) => item.id === "launch_checklist")?.detail).toBe(
      "2 pending: SSL certificate, Analytics tag",
    );
    expect(
      items.find((item) => item.id === "launch_checklist")?.pendingLabels,
    ).toEqual(["SSL certificate", "Analytics tag"]);
  });

  it("formats blocker messages with fix hints", () => {
    const items = buildProjectDeliveryAnalysis({
      briefPercent: 40,
      productionUrl: "",
      credentialsCount: 0,
      pendingChecklistCount: 0,
      resourcesCount: 0,
      hasPortalAccount: false,
      hasLinkedContact: false,
    });

    const message = formatDeliveryAnalysisBlockerMessage(items);
    expect(message).toContain("Brief completed");
    expect(message).toContain("Complete the website brief in the Brief tab");
    expect(message).toContain("Production URL");
    expect(message).toContain("Security");
  });
});
