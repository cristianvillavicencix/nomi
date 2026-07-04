import { describe, expect, it } from "vitest";
import { resolveSettingsRoute } from "./settingsNavigation";

describe("resolveSettingsRoute", () => {
  it("maps legacy messaging tab to connectors", () => {
    const params = new URLSearchParams("tab=messaging");
    expect(resolveSettingsRoute(params).tab).toBe("connectors");
  });

  it("maps legacy connectors content to communications", () => {
    const route = resolveSettingsRoute(
      new URLSearchParams("tab=connectors&section=content"),
    );
    expect(route.tab).toBe("communications");
    expect(route.communicationsSection).toBe("templates");
  });

  it("maps legacy connectors notifications to notifications workspace", () => {
    const route = resolveSettingsRoute(
      new URLSearchParams("tab=connectors&section=notifications"),
    );
    expect(route.tab).toBe("notifications");
    expect(route.notificationsSection).toBe("workspace");
  });

  it("maps legacy forms notifications to notifications workspace", () => {
    const route = resolveSettingsRoute(
      new URLSearchParams("tab=forms&section=notifications"),
    );
    expect(route.tab).toBe("notifications");
    expect(route.notificationsSection).toBe("workspace");
  });

  it("maps legacy commercial catalog to products tab", () => {
    const params = new URLSearchParams("tab=commercial&section=catalog");
    expect(resolveSettingsRoute(params).tab).toBe("products");
  });

  it("defaults connectors section to twilio", () => {
    const route = resolveSettingsRoute(
      new URLSearchParams("tab=connectors"),
    );
    expect(route.tab).toBe("connectors");
    expect(route.connectorsSection).toBe("twilio");
  });

  it("maps legacy connectors search section to google", () => {
    const route = resolveSettingsRoute(
      new URLSearchParams("tab=connectors&section=search"),
    );
    expect(route.connectorsSection).toBe("google");
  });

  it("maps legacy connectors email section to mail", () => {
    const route = resolveSettingsRoute(
      new URLSearchParams("tab=connectors&section=email"),
    );
    expect(route.connectorsSection).toBe("mail");
  });

  it("maps legacy connectors tickets section to tickets tab", () => {
    const route = resolveSettingsRoute(
      new URLSearchParams("tab=connectors&section=tickets"),
    );
    expect(route.tab).toBe("tickets");
    expect(route.ticketsSection).toBe("outbound");
  });

  it("defaults tickets section to outbound", () => {
    const route = resolveSettingsRoute(new URLSearchParams("tab=tickets"));
    expect(route.tab).toBe("tickets");
    expect(route.ticketsSection).toBe("outbound");
  });

  it("maps legacy tickets inbox section to outbound", () => {
    const route = resolveSettingsRoute(
      new URLSearchParams("tab=tickets&section=inbox"),
    );
    expect(route.ticketsSection).toBe("outbound");
  });

  it("resolves tickets inbound section", () => {
    const route = resolveSettingsRoute(
      new URLSearchParams("tab=tickets&section=inbound"),
    );
    expect(route.ticketsSection).toBe("inbound");
  });
});
