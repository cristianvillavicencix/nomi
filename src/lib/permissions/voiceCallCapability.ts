import {
  getStoredRolePreset,
  inferLegacyRolePreset,
  permissionsMapFromRolePreset,
} from "@/lib/permissions/permissionCatalog";

const VOICE_MAKE_CAPABILITY = "voice.calls.make";

/** Matches resolveEffectivePermissions + voice.calls.make for CRM + Edge routing. */
export function memberHasVoiceCallCapability(
  member:
    | {
        administrator?: boolean | null;
        roles?: unknown;
        module_permissions?: Record<string, boolean | string | undefined> | null;
      }
    | null
    | undefined,
): boolean {
  if (!member) return false;
  if (member.administrator === true) return true;

  const stored = member.module_permissions;
  const preset =
    (stored != null &&
    typeof stored === "object" &&
    !Array.isArray(stored) &&
    getStoredRolePreset(stored)) ||
    inferLegacyRolePreset(member);

  let effective =
    permissionsMapFromRolePreset(preset)[VOICE_MAKE_CAPABILITY] === true;

  if (stored != null && typeof stored === "object" && !Array.isArray(stored)) {
    const override = stored[VOICE_MAKE_CAPABILITY];
    if (typeof override === "boolean") {
      effective = override;
    }
  }

  return effective;
}
