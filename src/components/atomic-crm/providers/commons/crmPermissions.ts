import {
  getCapabilityForResourceAction,
  hasCapability,
  resolveEffectivePermissions,
} from "@/lib/permissions/permissionCatalog";
import {
  getAccessRoles,
  type AccessIdentity,
  type AccessRole,
} from "./canAccess";
import { resolveEffectiveModules } from "./memberModuleAccess";

export type CrmPermission = "sales.view" | "sales.manage";

export type CrmMutationAction = "create" | "update" | "delete";

const hasRole = (roles: AccessRole[], expected: AccessRole[]) =>
  expected.some((role) => roles.includes(role));

const MUTATION_ACTION_TO_CAPABILITY_ACTION: Record<CrmMutationAction, string> =
  {
    create: "create",
    update: "edit",
    delete: "delete",
  };

const DEAL_FIN_RESOURCES = new Set([
  "deal_expenses",
  "deal_change_orders",
  "deal_client_payments",
]);
const DEAL_OPS_RESOURCES = new Set([
  "deal_resources",
  "deal_access_entries",
]);

function canMutateViaCatalog(
  identity: AccessIdentity,
  resource: string,
  action: CrmMutationAction,
): boolean | null {
  const capAction = MUTATION_ACTION_TO_CAPABILITY_ACTION[action];
  const capId = getCapabilityForResourceAction(resource, capAction);
  if (!capId) return null;
  const perms = resolveEffectivePermissions(identity);
  return hasCapability(perms, capId, { administrator: identity.administrator });
}

function modulesAllowMutationLegacy(
  identity: AccessIdentity,
  permission: CrmPermission,
  resource?: string,
) {
  const mods = resolveEffectiveModules(identity);
  const salesBand =
    mods.crm ||
    mods.proposals ||
    mods.forms ||
    mods.support ||
    mods.messaging ||
    mods.deal_operations ||
    mods.deal_financials;

  switch (permission) {
    case "sales.view":
    case "sales.manage": {
      if (resource && DEAL_FIN_RESOURCES.has(resource)) {
        return mods.deal_financials && salesBand;
      }
      if (resource && DEAL_OPS_RESOURCES.has(resource)) {
        return mods.deal_operations && (mods.crm || salesBand);
      }
      return salesBand;
    }
    default:
      return false;
  }
}

export const canUseCrmPermission = (
  identity: AccessIdentity | string | null | undefined,
  permission: CrmPermission,
  mutationResource?: string,
) => {
  if (
    identity &&
    typeof identity === "object" &&
    (identity as AccessIdentity).administrator === true
  ) {
    return true;
  }

  const idObj =
    identity && typeof identity === "object"
      ? (identity as AccessIdentity)
      : undefined;

  if (idObj && mutationResource) {
    const action = permission === "sales.manage" ? "edit" : "list";
    const catalogHit = canMutateViaCatalog(
      idObj,
      mutationResource,
      action as CrmMutationAction,
    );
    if (catalogHit != null) return catalogHit;
  }

  if (idObj?.module_permissions != null) {
    return modulesAllowMutationLegacy(idObj, permission, mutationResource);
  }

  const roles = getAccessRoles(identity);

  if (roles.includes("admin")) {
    return true;
  }

  switch (permission) {
    case "sales.view":
    case "sales.manage":
      return hasRole(roles, ["sales_manager", "manager", "employee"]);
    default:
      return false;
  }
};

const getMutationPermission = (
  resource: string,
  action: CrmMutationAction,
): CrmPermission | null => {
  if (resource === "configuration") {
    return null;
  }

  if (
    getCapabilityForResourceAction(
      resource,
      MUTATION_ACTION_TO_CAPABILITY_ACTION[action],
    )
  ) {
    return "sales.manage";
  }
  return null;
};

export const canMutateCrmResource = ({
  identity,
  resource,
  action,
}: {
  identity: AccessIdentity | string | null | undefined;
  resource: string;
  action: CrmMutationAction;
  data?: Record<string, unknown>;
}) => {
  if (
    identity &&
    typeof identity === "object" &&
    (identity as AccessIdentity).administrator === true
  ) {
    return true;
  }

  if (resource === "configuration") {
    if (identity && typeof identity === "object") {
      const perms = resolveEffectivePermissions(identity as AccessIdentity);
      return hasCapability(perms, "admin.settings.manage", {
        administrator: (identity as AccessIdentity).administrator,
      });
    }
    return false;
  }

  if (identity && typeof identity === "object") {
    const catalogHit = canMutateViaCatalog(
      identity as AccessIdentity,
      resource,
      action,
    );
    if (catalogHit != null) return catalogHit;
  }

  const permission = getMutationPermission(resource, action);
  if (!permission) return true;
  return canUseCrmPermission(identity, permission, resource);
};
