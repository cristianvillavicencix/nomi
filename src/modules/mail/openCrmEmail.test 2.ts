import { describe, expect, it, vi } from "vitest";
import { openCrmEmailWithFallback } from "./openCrmEmailUtils";

describe("openCrmEmailWithFallback", () => {
  it("opens in-app compose when mailbox is available", () => {
    const openCompose = vi.fn();
    openCrmEmailWithFallback(
      { to: "client@example.com", contactId: 1 },
      true,
      openCompose,
    );
    expect(openCompose).toHaveBeenCalledWith({
      mode: "new",
      initialTo: "client@example.com",
      contactId: 1,
      companyId: undefined,
      initialSubject: undefined,
      initialBody: undefined,
    });
  });

  it("falls back to mailto when compose is unavailable", () => {
    const openCompose = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "" },
    });

    openCrmEmailWithFallback({ to: "client@example.com" }, false, openCompose);

    expect(openCompose).not.toHaveBeenCalled();
    expect(window.location.href).toBe("mailto:client@example.com");

    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });
});
