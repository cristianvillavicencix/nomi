import { useGetIdentity } from "ra-core";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import {
  getStoredRolePresetKey,
  isBuiltInRolePreset,
} from "@/lib/permissions/permissionCatalog";
import {
  getPresetDisplayLabel,
  parseOrgRbacConfig,
} from "@/lib/permissions/orgRolePresets";

export function useMemberRoleLabel(fallback = "User") {
  const { identity } = useGetIdentity();
  const orgId = (identity as { org_id?: number | null } | undefined)?.org_id;

  const { data: orgConfig } = useQuery({
    queryKey: ["org-rbac-config", orgId],
    enabled: orgId != null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("rbac_config")
        .eq("id", orgId!)
        .maybeSingle();
      if (error) throw error;
      return parseOrgRbacConfig(data?.rbac_config);
    },
    staleTime: 60_000,
  });

  if (!identity) return fallback;

  const modulePermissions = (
    identity as { module_permissions?: Record<string, unknown> | null }
  ).module_permissions;

  const presetKey =
    getStoredRolePresetKey(modulePermissions) ??
    ((identity as { administrator?: boolean }).administrator
      ? "super_admin"
      : (() => {
          const role = (identity as { roles?: string[] }).roles?.[0];
          if (role && (isBuiltInRolePreset(role) || role.startsWith("custom:"))) {
            return role;
          }
          return "user";
        })());

  return getPresetDisplayLabel(presetKey, orgConfig ?? undefined);
}
