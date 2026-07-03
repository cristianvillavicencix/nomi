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

  it("defaults to company", () => {
    const params = new URLSearchParams();
    expect(resolveSettingsRoute(params).tab).toBe("company");
  });
});
