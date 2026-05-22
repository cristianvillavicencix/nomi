import {
  CAPABILITY_IDS,
  collapsePermissionsForSave,
  CUSTOM_ROLE_PRESET_PREFIX,
  permissionsMapFromRolePreset,
  ROLE_PRESET_KEY,
  ROLE_PRESETS,
  SCOPED_TO_PROJECTS_KEY,
  type RoleSlug,
} from "./permissionCatalog";

export type OrgCustomRolePreset = {
  label: string;
  description?: string;
  /** Built-in preset used as the capability template. */
  basedOn: RoleSlug;
  /** When true, Postgres + UI scope deals/messages to assigned projects. */
  scopedToAssignedProjects?: boolean;
};

export type OrgRbacConfig = {
  /** Override display labels for built-in presets (e.g. user → "Field operator"). */
  presetLabels?: Partial<Record<RoleSlug, string>>;
  customPresets?: Record<string, OrgCustomRolePreset>;
};

export const emptyOrgRbacConfig = (): OrgRbacConfig => ({});

export function parseOrgRbacConfig(raw: unknown): OrgRbacConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return emptyOrgRbacConfig();
  }
  const value = raw as OrgRbacConfig;
  return {
    presetLabels:
      value.presetLabels && typeof value.presetLabels === "object"
        ? value.presetLabels
        : undefined,
    customPresets:
      value.customPresets && typeof value.customPresets === "object"
        ? value.customPresets
        : undefined,
  };
}

export function customPresetStorageKey(slug: string): string {
  return `${CUSTOM_ROLE_PRESET_PREFIX}${slug}`;
}

export function isCustomPresetStorageKey(value: string): boolean {
  return value.startsWith(CUSTOM_ROLE_PRESET_PREFIX);
}

export function customPresetSlugFromKey(value: string): string | null {
  if (!isCustomPresetStorageKey(value)) return null;
  const slug = value.slice(CUSTOM_ROLE_PRESET_PREFIX.length).trim();
  return slug.length > 0 ? slug : null;
}

export function getPresetDisplayLabel(
  presetKey: string,
  orgConfig?: OrgRbacConfig | null,
): string {
  const customSlug = customPresetSlugFromKey(presetKey);
  if (customSlug) {
    return orgConfig?.customPresets?.[customSlug]?.label ?? customSlug;
  }
  if (presetKey in ROLE_PRESETS) {
    const slug = presetKey as RoleSlug;
    return orgConfig?.presetLabels?.[slug] ?? ROLE_PRESETS[slug].label;
  }
  return presetKey;
}

export function getPresetDescription(
  presetKey: string,
  orgConfig?: OrgRbacConfig | null,
): string {
  const customSlug = customPresetSlugFromKey(presetKey);
  if (customSlug) {
    const custom = orgConfig?.customPresets?.[customSlug];
    if (custom?.description) return custom.description;
    return `Custom role based on ${ROLE_PRESETS[custom.basedOn]?.label ?? custom.basedOn}`;
  }
  if (presetKey in ROLE_PRESETS) {
    return ROLE_PRESETS[presetKey as RoleSlug].description;
  }
  return "";
}

export function listSelectablePresetKeys(orgConfig?: OrgRbacConfig | null): string[] {
  const builtIn = (Object.keys(ROLE_PRESETS) as RoleSlug[]).map((slug) => slug);
  const custom = Object.keys(orgConfig?.customPresets ?? {}).map((slug) =>
    customPresetStorageKey(slug),
  );
  return [...builtIn, ...custom];
}

export function applyCustomPresetToPermissions(
  slug: string,
  template: OrgCustomRolePreset,
): Record<string, boolean | string> {
  const base = permissionsMapFromRolePreset(template.basedOn);
  const merged: Record<string, boolean | string> = {
    ...base,
    [ROLE_PRESET_KEY]: customPresetStorageKey(slug),
  };
  if (template.basedOn === "user" || template.scopedToAssignedProjects === true) {
    merged[SCOPED_TO_PROJECTS_KEY] = true;
  }
  return collapsePermissionsForSave(merged, null);
}

export function isScopedToAssignedProjects(
  presetKey: string | null | undefined,
  orgConfig?: OrgRbacConfig | null,
): boolean {
  if (!presetKey) return false;
  if (presetKey === "user") return true;
  const customSlug = customPresetSlugFromKey(presetKey);
  if (!customSlug) return false;
  const custom = orgConfig?.customPresets?.[customSlug];
  if (!custom) return false;
  return custom.scopedToAssignedProjects !== false && custom.basedOn === "user";
}

export function normalizeCustomPresetSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

export function buildCustomPresetCapabilities(
  basedOn: RoleSlug,
): Record<string, boolean | string> {
  const caps = permissionsMapFromRolePreset(basedOn);
  const out: Record<string, boolean | string> = {};
  for (const id of CAPABILITY_IDS) {
    out[id] = caps[id] === true;
  }
  return out;
}
