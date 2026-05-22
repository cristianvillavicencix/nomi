import assert from "node:assert/strict";
import {
  CAPABILITIES,
  CAPABILITY_IDS,
  getCapabilitiesForRole,
  getCapabilityForResourceAction,
  hasCapability,
  permissionsMapFromRolePreset,
  ROLE_PRESETS,
} from "../permissionCatalog";

assert.equal(CAPABILITIES.length, 58, "expected 58 catalog capabilities");
assert.equal(CAPABILITY_IDS.length, CAPABILITIES.length);

for (const role of ["super_admin", "admin", "user", "read_only"] as const) {
  const caps = getCapabilitiesForRole(role);
  assert.equal(caps.length, ROLE_PRESETS[role].capabilities.length);
  assert.ok(caps.includes("crm.contacts.view"));
}

assert.equal(
  getCapabilityForResourceAction("contacts", "create"),
  "crm.contacts.create",
);
assert.equal(
  getCapabilityForResourceAction("conversation_messages", "create"),
  "messaging.send",
);

const userPerms = permissionsMapFromRolePreset("user");
assert.equal(hasCapability(userPerms, "messaging.send"), true);
assert.equal(hasCapability(userPerms, "view_amounts.show"), false);
assert.equal(hasCapability(userPerms, "admin.settings.manage"), false);

const adminPerms = permissionsMapFromRolePreset("admin");
assert.equal(hasCapability(adminPerms, "admin.users.manage"), true);
assert.equal(hasCapability(adminPerms, "admin.settings.manage"), false);

console.log("permissionCatalog.test.ts passed");
