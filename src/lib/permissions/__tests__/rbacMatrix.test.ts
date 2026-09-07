import { describe, expect, it } from "vitest";
import { canAccess } from "@/components/atomic-crm/providers/commons/canAccess";
import {
  ROLE_PRESET_KEY,
  getCapabilityForResourceAction,
  hasCapability,
  type RoleSlug,
} from "@/lib/permissions/permissionCatalog";

const identityFor = (slug: RoleSlug) => ({
  administrator: slug === "super_admin",
  role: slug === "super_admin" ? "admin" : slug,
  module_permissions: {
    [ROLE_PRESET_KEY]: slug,
  },
});

const MATRIX: Array<{
  resource: string;
  action: string;
  owner: boolean;
  admin: boolean;
  junior: boolean;
}> = [
  { resource: "client_invoices", action: "list", owner: true, admin: true, junior: false },
  { resource: "client_invoices", action: "create", owner: true, admin: true, junior: false },
  { resource: "deals", action: "list", owner: true, admin: true, junior: true },
  { resource: "deals", action: "delete", owner: true, admin: true, junior: false },
  { resource: "tickets", action: "list", owner: true, admin: true, junior: false },
  { resource: "tickets", action: "edit", owner: true, admin: true, junior: false },
  { resource: "configuration", action: "edit", owner: true, admin: false, junior: false },
];

describe("RBAC matrix (owner / admin / junior)", () => {
  it.each(MATRIX)(
    "$resource $action",
    ({ resource, action, owner, admin, junior }) => {
      expect(canAccess(identityFor("super_admin"), { resource, action })).toBe(
        owner,
      );
      expect(canAccess(identityFor("admin"), { resource, action })).toBe(admin);
      expect(canAccess(identityFor("user"), { resource, action })).toBe(junior);
    },
  );

  it("maps resources through the capability catalog", () => {
    expect(getCapabilityForResourceAction("client_invoices", "list")).toBe(
      "proposals.view",
    );
    expect(getCapabilityForResourceAction("tickets", "edit")).toBe(
      "support.tickets.manage",
    );
    expect(getCapabilityForResourceAction("deals", "list")).toBe(
      "crm.pipeline.view",
    );
  });

  it("does not grant invoices from UI hide alone — junior lacks the capability", () => {
    expect(
      hasCapability(
        { [ROLE_PRESET_KEY]: "user" },
        "proposals.view",
        { administrator: false },
      ),
    ).toBe(false);
  });
});
