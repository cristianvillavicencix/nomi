import assert from "node:assert/strict";
import {
  CAPABILITIES,
  CAPABILITY_IDS,
  getCapabilitiesForRole,
  getCapabilityForResourceAction,
  hasCapability,
  permissionsMapFromRolePreset,
  resolveEffectivePermissions,
  ROLE_PRESETS,
} from "../permissionCatalog";

assert.equal(CAPABILITIES.length, 81, "expected 81 catalog capabilities");
assert.equal(CAPABILITY_IDS.length, CAPABILITIES.length);

for (const role of ["super_admin", "admin", "user", "read_only"] as const) {
  const caps = getCapabilitiesForRole(role);
  assert.equal(caps.length, ROLE_PRESETS[role].capabilities.length);
  if (role !== "user") {
    assert.ok(caps.includes("crm.contacts.view"));
  }
}

assert.equal(
  getCapabilityForResourceAction("contacts", "create"),
  "crm.contacts.create",
);
assert.equal(
  getCapabilityForResourceAction("conversation_messages", "create"),
  "messaging.send",
);
assert.equal(
  getCapabilityForResourceAction("record_shares", "create"),
  "records.share",
);

const userPerms = permissionsMapFromRolePreset("user");
assert.equal(hasCapability(userPerms, "crm.contacts.view"), false);
assert.equal(hasCapability(userPerms, "crm.companies.view"), false);
assert.equal(hasCapability(userPerms, "proposals.view"), false);
assert.equal(hasCapability(userPerms, "contracts.view"), false);
assert.equal(hasCapability(userPerms, "records.share"), false);
assert.equal(hasCapability(userPerms, "messaging.send"), true);
assert.equal(hasCapability(userPerms, "crm.pipeline.view"), true);
assert.equal(hasCapability(userPerms, "crm.upload_images"), true);
assert.equal(hasCapability(userPerms, "view_amounts.show"), false);
assert.equal(hasCapability(userPerms, "admin.settings.manage"), false);

const adminPerms = permissionsMapFromRolePreset("admin");
assert.equal(hasCapability(adminPerms, "admin.users.manage"), true);
assert.equal(hasCapability(adminPerms, "admin.settings.manage"), false);
assert.equal(hasCapability(adminPerms, "admin.billing.manage"), false);
assert.equal(hasCapability(adminPerms, "records.share"), true);

const readOnlyPerms = permissionsMapFromRolePreset("read_only");
assert.equal(hasCapability(readOnlyPerms, "crm.tasks.view"), true);
assert.equal(hasCapability(readOnlyPerms, "crm.tasks.create"), false);
assert.equal(hasCapability(readOnlyPerms, "messaging.send"), false);
assert.equal(hasCapability(readOnlyPerms, "proposals.view"), false);
assert.equal(hasCapability(readOnlyPerms, "people.view"), true);

const legacyUserWithAmounts = resolveEffectivePermissions({
  administrator: false,
  roles: ["employee"],
  module_permissions: {
    crm: true,
    view_amounts: true,
    "view_amounts.show": true,
    "crm.pipeline.view": true,
  },
});
assert.equal(legacyUserWithAmounts["view_amounts.show"], false);

console.warn("permissionCatalog.test.ts passed");
