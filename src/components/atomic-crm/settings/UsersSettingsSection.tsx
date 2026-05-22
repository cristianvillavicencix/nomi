import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, Loader2, Plus, Trash2 } from "lucide-react";
import {
  Form,
  required,
  useDataProvider,
  useGetIdentity,
  useGetList,
  useGetOne,
  useNotify,
  useRefresh,
} from "ra-core";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState, Fragment } from "react";
import { useController, useFormContext } from "react-hook-form";
import { useSearchParams } from "react-router";
import { EmailInput } from "@/components/admin/email-input";
import { TextInput } from "@/components/admin/text-input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { DEFAULT_SEAT_USD_PER_MONTH } from "@/platform/billingDefaults";
import { inviteBillingSeatGateDisabled } from "@/platform/inviteBillingGate";

const SKIP_INVITE_SEAT_BILLING = inviteBillingSeatGateDisabled();
import type { AccessIdentity } from "../providers/commons/canAccess";
import {
  applyRolePresetToPermissions,
  deriveRolesFromModulePermissions,
  resolveEffectiveModules,
} from "../providers/commons/memberModuleAccess";
import {
  getStoredRolePreset,
  getStoredRolePresetKey,
  ROLE_PRESETS,
  type RoleSlug,
} from "@/lib/permissions/permissionCatalog";
import {
  applyCustomPresetToPermissions,
  customPresetSlugFromKey,
  getPresetDisplayLabel,
  listSelectablePresetKeys,
  parseOrgRbacConfig,
  type OrgRbacConfig,
} from "@/lib/permissions/orgRolePresets";
import { NewRolePresetDialog } from "./NewRolePresetDialog";
import type { CrmDataProvider } from "../providers/types";
import type {
  MemberModuleKey,
  OrganizationMember,
  OrganizationMemberFormData,
} from "../types";
import {
  collapsePermissionsForSave,
  expandPermissionsForForm,
  getWorkspacePermissionGroups,
} from "./workspacePermissionTree";

const BILLING_ALLOWS_SEATS = new Set([
  "active",
  "trialing",
  "past_due",
  "incomplete",
  "unpaid",
  "paused",
]);

const BILLING_STATUS_SHORT: Record<string, string> = {
  none: "Not subscribed",
  trialing: "Trialing",
  active: "Active",
  past_due: "Past due",
  canceled: "Canceled",
  incomplete: "Incomplete",
  incomplete_expired: "Incomplete (expired)",
  unpaid: "Unpaid",
  paused: "Paused",
};

const CAN_BUY_ADD_SEAT = new Set(["active", "trialing", "past_due"]);

const USERS_RETURN = "/settings?tab=users";
const USERS_INVITE_CHECKOUT = "/settings?tab=users&invite=1";

const formatUsd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n,
  );

const MODULE_SUMMARY_LABELS: Record<MemberModuleKey, string> = {
  crm: "CRM",
  proposals: "Proposals",
  forms: "Forms",
  support: "Support",
  messaging: "Messaging",
  deal_operations: "Deal operations",
  deal_financials: "Deal financials",
  payroll: "Payroll",
  people: "People",
  time: "Time",
  reports: "Reports",
  view_amounts: "Amount visibility",
};

const getModuleAreas = () => getWorkspacePermissionGroups();

type UserDialogState =
  | { mode: "create" }
  | { mode: "edit"; sale: OrganizationMember };

type UserFormValues = OrganizationMemberFormData & { id?: number | string };

const UserModulesInput = ({
  orgRbacConfig,
  disableAdministrator,
  isEditingSelf,
}: {
  orgRbacConfig: OrgRbacConfig;
  disableAdministrator: boolean;
  isEditingSelf: boolean;
}) => {
  const { field } = useController<UserFormValues>({
    name: "module_permissions",
    defaultValue: {},
  });
  const { field: administratorField } = useController<UserFormValues>({
    name: "administrator",
    defaultValue: false,
  });

  const administrator = administratorField.value === true;
  const canSetAdministrator = !disableAdministrator && !isEditingSelf;

  const groups = getWorkspacePermissionGroups();
  const caps = {
    ...(typeof field.value === "object" && field.value !== null
      ? field.value
      : {}),
  } satisfies Record<string, boolean | string>;

  const activePreset = administrator ? null : getStoredRolePresetKey(caps);

  const setCapability = (id: string, checked: boolean) => {
    const next = { ...caps, [id]: checked };
    field.onChange(collapsePermissionsForSave(next, getStoredRolePreset(next)));
  };

  const applyPreset = (presetKey: string) => {
    administratorField.onChange(false);
    const customSlug = customPresetSlugFromKey(presetKey);
    if (customSlug) {
      const template = orgRbacConfig.customPresets?.[customSlug];
      if (!template) return;
      field.onChange(collapsePermissionsForSave(applyCustomPresetToPermissions(customSlug, template)));
      return;
    }
    const next = applyRolePresetToPermissions(presetKey as RoleSlug);
    field.onChange(collapsePermissionsForSave(next, presetKey as RoleSlug));
  };

  const selectAdministrator = () => {
    if (!canSetAdministrator) return;
    administratorField.onChange(true);
  };

  const presetKeys = listSelectablePresetKeys(orgRbacConfig);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Role & access</p>
        <p className="text-xs text-muted-foreground">
          Pick a role preset. Fine-tune individual permissions below when needed.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {administrator && !canSetAdministrator ? (
          <Button type="button" size="sm" variant="default" disabled>
            Administrator
          </Button>
        ) : null}
        {canSetAdministrator ? (
          <Button
            type="button"
            size="sm"
            variant={administrator ? "default" : "outline"}
            onClick={selectAdministrator}
          >
            Administrator
          </Button>
        ) : null}
        {presetKeys.map((presetKey) => (
          <Button
            key={presetKey}
            type="button"
            size="sm"
            variant={!administrator && activePreset === presetKey ? "default" : "outline"}
            disabled={administrator}
            onClick={() => applyPreset(presetKey)}
          >
            {getPresetDisplayLabel(presetKey, orgRbacConfig)}
          </Button>
        ))}
      </div>
      {administrator ? (
        <p className="text-xs text-muted-foreground">
          Workspace administrators have full access to every area.
        </p>
      ) : (
        <>
          <div>
            <p className="text-sm font-medium">Workspace permissions</p>
            <p className="text-xs text-muted-foreground">
              Optional overrides on top of the selected role preset.
            </p>
          </div>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/20 text-left text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Permission</th>
                  <th className="w-24 px-4 py-2.5 text-right font-medium">
                    Access
                  </th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <Fragment key={group.area}>
                    <tr className="border-b border-border/40 bg-muted/30">
                      <td
                        colSpan={2}
                        className="px-4 py-2.5 text-sm font-semibold tracking-tight"
                      >
                        {group.label}
                      </td>
                    </tr>
                    {group.items.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-border/40 last:border-0"
                      >
                        <td className="px-4 py-2.5 pl-10 text-muted-foreground">
                          {item.label}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <Switch
                            checked={caps[item.id] === true}
                            onCheckedChange={(checked) =>
                              setCapability(item.id, checked)
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

const UserDialogFooter = ({
  mode,
  isEditingSelf,
  isPending,
  isRemoving,
  onCancel,
  onRemove,
}: {
  mode: "create" | "edit";
  isEditingSelf: boolean;
  isPending: boolean;
  isRemoving: boolean;
  onCancel: () => void;
  onRemove: () => void;
}) => {
  const { field: disabledField } = useController<UserFormValues>({
    name: "disabled",
    defaultValue: false,
  });

  return (
    <div className="flex flex-col-reverse gap-3 border-t border-border/40 pt-4 sm:flex-row sm:items-center sm:justify-between">
      {mode === "edit" ? (
        <Button
          type="button"
          variant="destructive"
          onClick={onRemove}
          disabled={isEditingSelf || isPending || isRemoving}
        >
          {isRemoving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="mr-2 h-4 w-4" />
          )}
          Remove user
        </Button>
      ) : (
        <div className="hidden sm:block" />
      )}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {mode === "edit" ? (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch
              checked={disabledField.value === true}
              disabled={isEditingSelf || isPending || isRemoving}
              onCheckedChange={disabledField.onChange}
            />
            Disabled
          </label>
        ) : null}
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isPending || isRemoving}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || isRemoving}>
          {mode === "edit" ? "Save" : "Send invitation"}
        </Button>
      </div>
    </div>
  );
};

const UserFormFields = ({
  mode,
  disableAdministrator,
  currentIdentityId,
  orgRbacConfig,
}: {
  mode: "create" | "edit";
  disableAdministrator: boolean;
  currentIdentityId?: string | number;
  orgRbacConfig: OrgRbacConfig;
}) => {
  const { watch } = useFormContext<UserFormValues>();
  const currentId = watch("id");
  const isEditingSelf =
    currentId != null && String(currentId) === String(currentIdentityId ?? "");

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          source="first_name"
          validate={required()}
          helperText={false}
        />
        <TextInput
          source="last_name"
          validate={required()}
          helperText={false}
        />
      </div>
      <EmailInput source="email" validate={required()} helperText={false} />
      {mode === "create" ? (
        <p className="text-xs text-muted-foreground">
          We&apos;ll email them an invitation link so they can choose their own password before signing in.
        </p>
      ) : null}

      <UserModulesInput
        orgRbacConfig={orgRbacConfig}
        disableAdministrator={disableAdministrator}
        isEditingSelf={isEditingSelf}
      />
    </div>
  );
};

const UserDialog = ({
  open,
  onOpenChange,
  state,
  existingAdminId,
  orgRbacConfig,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: UserDialogState | null;
  existingAdminId?: number | string;
  orgRbacConfig: OrgRbacConfig;
}) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const refresh = useRefresh();
  const { data: identity } = useGetIdentity();

  const sale = state?.mode === "edit" ? state.sale : undefined;
  const editMemberId = sale?.id;

  const { data: freshMember, isFetching: isFetchingMember } =
    useGetOne<OrganizationMember>(
      "organization_members",
      { id: editMemberId! },
      { enabled: open && editMemberId != null },
    );

  const memberForForm =
    state?.mode === "edit" ? (freshMember ?? sale) : undefined;

  const defaultValues = useMemo<UserFormValues>(() => {
    const identityDraft: AccessIdentity =
      memberForForm != null
        ? {
            administrator: !!memberForForm.administrator,
            roles: memberForForm.roles,
            module_permissions: memberForForm.module_permissions ?? null,
          }
        : {
            administrator: false,
            roles: [],
            module_permissions: null,
          };

    const expandedPermissions = expandPermissionsForForm(
      memberForForm?.module_permissions ?? null,
      identityDraft,
    );

    return {
      id: memberForForm?.id,
      first_name: memberForForm?.first_name ?? "",
      last_name: memberForForm?.last_name ?? "",
      email: memberForForm?.email ?? "",
      administrator: identityDraft.administrator ?? false,
      roles: deriveRolesFromModulePermissions(
        collapsePermissionsForSave(expandedPermissions),
        identityDraft.administrator ?? false,
      ),
      module_permissions: expandedPermissions,
      disabled: memberForForm?.disabled ?? false,
      avatar: memberForForm?.avatar ?? null,
    };
  }, [memberForForm]);

  const disableAdministrator =
    existingAdminId != null &&
    (state?.mode === "create" ||
      (sale != null && String(existingAdminId) !== String(sale.id)));

  const isEditingSelf =
    sale != null && String(sale.id) === String(identity?.id ?? "");

  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);

  const { mutate: removeUser, isPending: isRemoving } = useMutation({
    mutationFn: async () => {
      if (!sale) throw new Error("User not found");
      return dataProvider.organizationMemberUpdate(sale.id, { disabled: true });
    },
    onSuccess: () => {
      notify(`${sale?.first_name ?? "User"} no longer has access`, {
        type: "success",
      });
      setRemoveConfirmOpen(false);
      onOpenChange(false);
      refresh();
    },
    onError: (error: Error) => {
      notify(error.message || "Could not remove user", { type: "error" });
    },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: async (values: UserFormValues) => {
      const modulePermissions = values.administrator
        ? null
        : collapsePermissionsForSave(values.module_permissions ?? {});
      const payload: OrganizationMemberFormData = {
        ...values,
        roles: deriveRolesFromModulePermissions(
          modulePermissions ?? {},
          values.administrator,
        ),
        module_permissions: modulePermissions,
      };
      if (state?.mode === "edit" && sale) {
        return dataProvider.organizationMemberUpdate(sale.id, payload);
      }
      return dataProvider.organizationMemberCreate(payload);
    },
    onSuccess: () => {
      notify(
        state?.mode === "edit"
          ? "User updated successfully"
          : "Invitation sent. They will receive an email to set their password.",
      );
      onOpenChange(false);
      refresh();
    },
    onError: (error: Error) => {
      notify(error.message || "Could not save user", { type: "error" });
    },
  });

  if (!state) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {state.mode === "edit" ? "User & access" : "New user"}
          </DialogTitle>
          {state.mode === "edit" && sale ? (
            <DialogDescription>
              Profile details and which workspace areas {sale.first_name} can use.
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <Form
          key={
            state.mode === "edit"
              ? `edit-${String(memberForForm?.id ?? sale?.id ?? "")}-${isFetchingMember ? "loading" : "ready"}`
              : "create"
          }
          defaultValues={defaultValues}
          onSubmit={(values) => mutate(values as UserFormValues)}
          className="space-y-5"
        >
          <UserFormFields
            mode={state.mode}
            disableAdministrator={disableAdministrator}
            currentIdentityId={identity?.id}
            orgRbacConfig={orgRbacConfig}
          />
          <UserDialogFooter
            mode={state.mode}
            isEditingSelf={isEditingSelf}
            isPending={isPending}
            isRemoving={isRemoving}
            onCancel={() => onOpenChange(false)}
            onRemove={() => setRemoveConfirmOpen(true)}
          />
        </Form>
      </DialogContent>

      <Dialog open={removeConfirmOpen} onOpenChange={setRemoveConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove user access?</DialogTitle>
            <DialogDescription>
              {sale
                ? `${sale.first_name} ${sale.last_name} will be disabled and cannot sign in. Their CRM data is kept; you can re-enable access later with the Disabled switch.`
                : "This user will lose access to the workspace."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRemoveConfirmOpen(false)}
              disabled={isRemoving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => removeUser()}
              disabled={isRemoving || isEditingSelf}
            >
              {isRemoving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Remove user
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};

const ModuleBadges = ({ sale }: { sale: OrganizationMember }) => {
  if (sale.administrator) {
    return (
      <span className="text-xs text-muted-foreground">
        All areas · administrator
      </span>
    );
  }

  const preset = getStoredRolePreset(sale.module_permissions ?? undefined);
  if (preset) {
    return (
      <span className="text-xs text-muted-foreground">
        {ROLE_PRESETS[preset].label}
      </span>
    );
  }

  const perms = sale.module_permissions;
  const activeAreas = getModuleAreas().filter((area) =>
    area.items.some((item) => perms?.[item.id] === true),
  );
  if (activeAreas.length > 0) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {activeAreas.map((area) => (
          <span key={area.area} className="rounded-full border px-2 py-0.5 text-xs">
            {area.label}
          </span>
        ))}
      </div>
    );
  }

  const mods = resolveEffectiveModules({
    administrator: !!sale.administrator,
    roles: sale.roles,
    module_permissions: sale.module_permissions ?? null,
  });

  const activeKeys = (Object.keys(MODULE_SUMMARY_LABELS) as MemberModuleKey[]).filter(
    (k) => mods[k],
  );
  if (!activeKeys.length) {
    return (
      <span className="text-xs text-muted-foreground">No modules resolved</span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {activeKeys.map((key) => (
        <span key={key} className="rounded-full border px-2 py-0.5 text-xs">
          {MODULE_SUMMARY_LABELS[key]}
        </span>
      ))}
    </div>
  );
};

const SectionIntro = ({
  internalOnly,
  priceUsd,
}: {
  internalOnly: boolean;
  priceUsd: number;
}) =>
  internalOnly ? (
    <p className="text-sm text-muted-foreground">
      Invite teammates and choose which workspace areas each person can use —
      CRM, messaging, payroll, and more — from one place.
    </p>
  ) : (
    <p className="text-sm text-muted-foreground">
      Each active person needs a paid seat. When you add someone new and you
      need another seat, this screen walks you to pay, then you can finish the
      invite. Price:{" "}
      <span className="text-foreground font-medium">{formatUsd(priceUsd)}</span>{" "}
      / user / month in Stripe (billed for licensed seats).
    </p>
  );

export const UsersSettingsSection = () => {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dialogState, setDialogState] = useState<UserDialogState | null>(null);
  const [newRolePresetOpen, setNewRolePresetOpen] = useState(false);
  const [seatGateOpen, setSeatGateOpen] = useState(false);
  const [seatGateKind, setSeatGateKind] = useState<"plan" | "seats" | null>(
    null,
  );
  const [payHandledCheckout, setPayHandledCheckout] = useState(false);

  const { data: identity, isPending: identityPending } = useGetIdentity();
  const isOrgAdmin = Boolean(
    identity &&
      typeof identity === "object" &&
      (identity as { administrator?: boolean }).administrator,
  );

  const { data: users = [], isPending } = useGetList<OrganizationMember>(
    "organization_members",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "id", order: "ASC" },
    },
  );

  const { data: orgRow, isLoading: orgLoading } = useQuery({
    queryKey: ["settings", "org_seat_gate"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select(
          "id, name, billable_seat_count, stripe_subscription_id, billing_status, price_per_seat_usd_monthly, stripe_customer_id, rbac_config",
        )
        .limit(1)
        .maybeSingle();
      if (error) {
        throw error;
      }
      return data;
    },
  });

  const [orgRbacConfig, setOrgRbacConfig] = useState<OrgRbacConfig>(() =>
    parseOrgRbacConfig(orgRow?.rbac_config),
  );

  useEffect(() => {
    setOrgRbacConfig(parseOrgRbacConfig(orgRow?.rbac_config));
  }, [orgRow?.rbac_config]);

  const dataProvider = useDataProvider<CrmDataProvider>();

  const priceUsd = Number(
    orgRow?.price_per_seat_usd_monthly ?? DEFAULT_SEAT_USD_PER_MONTH,
  );
  const statusKey = (orgRow?.billing_status ?? "none").trim() || "none";
  const statusLabel = BILLING_STATUS_SHORT[statusKey] ?? statusKey;
  const licensed = orgRow?.billable_seat_count;
  const orgId = orgRow?.id;

  const activeUserCount = useMemo(
    () => users.filter((u) => !u.disabled).length,
    [users],
  );
  const licensedNum =
    typeof licensed === "number" && licensed > 0 ? licensed : 0;
  const monthlyByLicenses = licensedNum * priceUsd;
  const perUserLabel = formatUsd(priceUsd) + " / user / month";

  const needsActivePlan = useMemo(() => {
    if (SKIP_INVITE_SEAT_BILLING) return false;
    if (orgRow == null) return false;
    const s = (orgRow.billing_status ?? "none").trim();
    return !orgRow.stripe_subscription_id || !BILLING_ALLOWS_SEATS.has(s);
  }, [orgRow]);

  const atLicensedSeatLimit = useMemo(() => {
    if (SKIP_INVITE_SEAT_BILLING) return false;
    if (orgRow == null || orgRow.billable_seat_count == null) return false;
    return activeUserCount >= orgRow.billable_seat_count;
  }, [orgRow, activeUserCount]);

  const blockNewCheckout =
    Boolean(orgRow?.stripe_subscription_id) &&
    [
      "active",
      "trialing",
      "past_due",
      "incomplete",
      "unpaid",
      "paused",
    ].includes((orgRow?.billing_status ?? "").trim());
  const canStartCheckout = !blockNewCheckout;
  const canAddOneInApp =
    Boolean(orgRow?.stripe_subscription_id) && CAN_BUY_ADD_SEAT.has(statusKey);

  const closeSeatGate = () => {
    setSeatGateOpen(false);
    setSeatGateKind(null);
  };

  const clearCheckoutQueryParams = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("checkout");
        next.delete("org_id");
        next.delete("invite");
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  useLayoutEffect(() => {
    if (searchParams.get("checkout") == null) {
      setPayHandledCheckout(false);
    }
  }, [searchParams]);

  useEffect(() => {
    if (payHandledCheckout) return;
    if (identityPending) return;
    const c = searchParams.get("checkout");
    if (c == null) return;
    if (c === "success") {
      setPayHandledCheckout(true);
      queryClient.invalidateQueries({
        queryKey: ["settings", "org_seat_gate"],
      });
      notify("Payment completed. You can add the new user now.", {
        type: "success",
      });
      if (
        searchParams.get("invite") === "1" ||
        searchParams.get("invite") === "true"
      ) {
        if (isOrgAdmin) {
          setDialogState({ mode: "create" });
        }
      }
      clearCheckoutQueryParams();
      return;
    }
    if (c === "cancel") {
      setPayHandledCheckout(true);
      notify("Checkout was closed without completing payment.");
      clearCheckoutQueryParams();
    }
  }, [
    searchParams,
    isOrgAdmin,
    identityPending,
    notify,
    queryClient,
    clearCheckoutQueryParams,
    payHandledCheckout,
  ]);

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (orgId == null) {
        throw new Error("No organization found.");
      }
      await dataProvider.stripeCreateCheckoutSession({
        orgId,
        returnPath: USERS_INVITE_CHECKOUT,
      });
    },
    onError: (e: Error) => {
      notify(e.message || "Could not start checkout", { type: "error" });
    },
  });

  const addOneSeatMutation = useMutation({
    mutationFn: async () => {
      if (orgId == null) {
        throw new Error("No organization found.");
      }
      return dataProvider.stripeAddOneSeat({ orgId, returnPath: USERS_RETURN });
    },
    onSuccess: (data) => {
      notify(
        `Seat added — ${data?.quantity != null ? `${data.quantity} licensed seat(s)` : "licensed in Stripe"}. You can add the new user now.`,
        { type: "success" },
      );
      queryClient.invalidateQueries({
        queryKey: ["settings", "org_seat_gate"],
      });
      closeSeatGate();
      setDialogState({ mode: "create" });
    },
    onError: (e: Error) => {
      notify(e.message || "Could not add a seat", { type: "error" });
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      if (orgId == null) {
        throw new Error("No organization found.");
      }
      await dataProvider.stripeBillingPortal({
        orgId,
        returnPath: USERS_RETURN,
      });
    },
    onError: (e: Error) => {
      notify(e.message || "Could not open billing", { type: "error" });
    },
  });

  const existingAdmin = users.find((user) => user.administrator);

  const openUserEditor = (sale: OrganizationMember) => {
    if (!isOrgAdmin) {
      notify("Only a company administrator can edit users.", {
        type: "warning",
      });
      return;
    }
    setDialogState({ mode: "edit", sale });
  };

  const onClickNewUser = () => {
    if (!isOrgAdmin) {
      notify(
        SKIP_INVITE_SEAT_BILLING
          ? "Only a company administrator can invite new users."
          : "Only a company administrator can invite new users and manage seats.",
        { type: "warning" },
      );
      return;
    }
    if (orgRow == null) {
      notify("Loading workspace…", { type: "info" });
      return;
    }
    if (needsActivePlan) {
      setSeatGateKind("plan");
      setSeatGateOpen(true);
      return;
    }
    if (atLicensedSeatLimit) {
      setSeatGateKind("seats");
      setSeatGateOpen(true);
      return;
    }
    setDialogState({ mode: "create" });
  };

  const onPrimarySeatAction = () => {
    if (seatGateKind === "plan" && canStartCheckout) {
      checkoutMutation.mutate();
    } else if (seatGateKind === "seats" && canAddOneInApp) {
      addOneSeatMutation.mutate();
    } else {
      if (orgRow?.stripe_customer_id) {
        portalMutation.mutate();
      } else {
        notify(
          "Open billing from the Manage button after you have a subscription, or try again in a moment.",
          {
            type: "info",
          },
        );
      }
    }
  };

  const tableBlock = (
    <>
      {isPending ? (
        <p className="text-sm text-muted-foreground">Loading users…</p>
      ) : (
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-muted-foreground">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Access</th>
                <th className="px-4 py-3">Areas</th>
                {SKIP_INVITE_SEAT_BILLING ? null : (
                  <th className="px-4 py-3">Seat / month</th>
                )}
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((sale) => (
                <tr
                  key={sale.id}
                  className={`border-b border-border/40 last:border-0 transition-colors hover:bg-muted/20 ${
                    isOrgAdmin ? "cursor-pointer" : ""
                  }`}
                  onClick={() => openUserEditor(sale)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {sale.first_name} {sale.last_name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {sale.email}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {sale.administrator ? (
                      <span className="rounded-full border px-2 py-0.5 text-xs font-medium">
                        Administrator
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Standard user
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ModuleBadges sale={sale} />
                  </td>
                  {SKIP_INVITE_SEAT_BILLING ? null : (
                    <td className="px-4 py-3 text-xs tabular-nums text-muted-foreground">
                      {licensed != null && orgRow
                        ? formatUsd(priceUsd) + " /user/mo"
                        : "—"}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <span className="text-xs text-muted-foreground">
                      {sale.disabled ? "Disabled" : "Active"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        openUserEditor(sale);
                      }}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="pt-3 text-xs text-muted-foreground">
        {existingAdmin
          ? `Administrator account: ${existingAdmin.first_name} ${existingAdmin.last_name}`
          : "No administrator found. Promote someone before assigning module access broadly."}
      </div>
    </>
  );

  const billingStrip = SKIP_INVITE_SEAT_BILLING ? null : isOrgAdmin &&
    !orgLoading &&
    orgRow ? (
    <div className="rounded-lg bg-muted/25 p-4 text-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Billing (workspace)
          </p>
          <p className="text-foreground">
            <span className="text-muted-foreground">Status: </span>
            {statusLabel}
          </p>
          <p className="text-foreground">
            <span className="text-muted-foreground">Seats: </span>
            {licensed == null
              ? "—"
              : `${activeUserCount} active of ${licensed} licensed`}{" "}
            {licensed != null && activeUserCount < licensed
              ? `(${licensed - activeUserCount} spare)`
              : null}
          </p>
          <p className="text-foreground">
            <span className="text-muted-foreground">Rate: </span>
            {perUserLabel} ·{" "}
            <span className="text-muted-foreground">
              est. for licensed pool:{" "}
            </span>
            <span className="font-medium tabular-nums">
              {formatUsd(monthlyByLicenses)}
            </span>{" "}
            / month
          </p>
          {orgRow.stripe_customer_id ? (
            <div className="pt-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
              >
                {portalMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Card, invoices, cancel plan
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  ) : !isOrgAdmin && !SKIP_INVITE_SEAT_BILLING ? (
    <p className="text-xs text-muted-foreground">
      Workspace billing and seats are only shown to a company{" "}
      <span className="text-foreground">administrator</span>.
    </p>
  ) : orgLoading && !SKIP_INVITE_SEAT_BILLING ? (
    <p className="text-sm text-muted-foreground flex items-center gap-2">
      <Loader2 className="h-4 w-4 animate-spin" />
      Loading billing…
    </p>
  ) : null;

  const payBusy =
    checkoutMutation.isPending ||
    addOneSeatMutation.isPending ||
    portalMutation.isPending;

  return (
    <>
      <div className="space-y-8 max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <h2 className="text-base font-semibold tracking-tight">Users</h2>
            <SectionIntro
              internalOnly={SKIP_INVITE_SEAT_BILLING}
              priceUsd={priceUsd}
            />
          </div>
          {isOrgAdmin ? (
            <div className="flex shrink-0 flex-wrap gap-2 self-start">
              <Button
                type="button"
                variant="outline"
                onClick={() => setNewRolePresetOpen(true)}
                disabled={orgLoading}
              >
                <Plus className="mr-2 h-4 w-4" />
                New role
              </Button>
              <Button
                type="button"
                onClick={onClickNewUser}
                disabled={orgLoading}
              >
                <Plus className="mr-2 h-4 w-4" />
                New user
              </Button>
            </div>
          ) : null}
        </div>
        <div className="space-y-6">
          {billingStrip}
          {tableBlock}
        </div>
      </div>

      <Dialog
        open={seatGateOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeSeatGate();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {seatGateKind === "plan"
                ? "Subscribe to add another user"
                : "Buy one more seat"}
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-1">
              {isOrgAdmin && seatGateKind === "plan" ? (
                <>
                  <span className="block">
                    Nomi bills per person. We’ll start secure checkout, then
                    you’ll land back <strong>here</strong> to open the{" "}
                    <strong>New user</strong> form.
                  </span>
                  {canStartCheckout ? null : (
                    <span className="block text-amber-600 dark:text-amber-500">
                      You already have a subscription in a pending state. Use
                      “Card, invoices” in this screen, or “Manage in Stripe”
                      from there.
                    </span>
                  )}
                </>
              ) : null}
              {isOrgAdmin && seatGateKind === "seats" ? (
                <span className="block">
                  You have <strong>{activeUserCount}</strong> of{" "}
                  <strong>{licensed}</strong> licensed seats. Add one more seat
                  in Stripe, then the new-user form will open. About{" "}
                  <strong>{perUserLabel}</strong> (prorated in Stripe for this
                  cycle).
                </span>
              ) : null}
              {!isOrgAdmin ? (
                <span className="block">
                  Your workspace administrator must add seats in{" "}
                  <strong>Settings → Users</strong> before you can invite.
                </span>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeSeatGate}>
              {seatGateKind === "plan" && isOrgAdmin && canStartCheckout
                ? "Not now"
                : "Close"}
            </Button>
            {isOrgAdmin && seatGateKind === "plan" && canStartCheckout ? (
              <Button
                type="button"
                onClick={onPrimarySeatAction}
                disabled={payBusy || orgId == null}
              >
                {checkoutMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Pay to subscribe
              </Button>
            ) : null}
            {isOrgAdmin && seatGateKind === "seats" && canAddOneInApp ? (
              <Button
                type="button"
                onClick={onPrimarySeatAction}
                disabled={payBusy || orgId == null}
              >
                {addOneSeatMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Add 1 seat &amp; continue
              </Button>
            ) : null}
            {isOrgAdmin &&
            seatGateKind === "seats" &&
            !canAddOneInApp &&
            orgRow?.stripe_customer_id ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => portalMutation.mutate()}
                disabled={payBusy}
              >
                {portalMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Manage in Stripe
              </Button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <NewRolePresetDialog
        open={newRolePresetOpen}
        onOpenChange={setNewRolePresetOpen}
        orgId={orgId}
        rbacConfig={orgRbacConfig}
        onSaved={setOrgRbacConfig}
      />

      <UserDialog
        open={dialogState != null}
        onOpenChange={(open) => {
          if (!open) setDialogState(null);
        }}
        state={dialogState}
        existingAdminId={existingAdmin?.id}
        orgRbacConfig={orgRbacConfig}
      />
    </>
  );
};
