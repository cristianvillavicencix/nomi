import { describe, expect, it } from "vitest";
import {
  DEFAULT_TICKET_WORKSPACE_SETTINGS,
  mergeTicketWorkspaceSettings,
  passesInboundDomainRules,
} from "./ticketWorkspaceSettings";

describe("mergeTicketWorkspaceSettings", () => {
  it("returns defaults for empty input", () => {
    expect(mergeTicketWorkspaceSettings(null)).toEqual(
      DEFAULT_TICKET_WORKSPACE_SETTINGS,
    );
  });

  it("merges partial patches", () => {
    const merged = mergeTicketWorkspaceSettings({
      auto_link_contact: false,
      default_priority: "high",
    });
    expect(merged.auto_link_contact).toBe(false);
    expect(merged.default_priority).toBe("high");
    expect(merged.notification_audience).toBe("assignee");
  });
});

describe("passesInboundDomainRules", () => {
  it("blocks listed domains", () => {
    const settings = mergeTicketWorkspaceSettings({
      blocked_inbound_domains: ["spam.com"],
    });
    expect(passesInboundDomainRules("a@spam.com", settings)).toBe(false);
    expect(passesInboundDomainRules("a@client.com", settings)).toBe(true);
  });
});
