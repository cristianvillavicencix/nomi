import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, Loader2, Plus } from "lucide-react";
import { Form, required, useDataProvider, useGetIdentity, useGetList, useNotify, useRefresh } from "ra-core";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useController, useFormContext } from "react-hook-form";
import { useSearchParams } from "react-router";
import { BooleanInput } from "@/components/admin/boolean-input";
import { EmailInput } from "@/components/admin/email-input";
import { TextInput } from "@/components/admin/text-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { DEFAULT_SEAT_USD_PER_MONTH } from "@/platform/billingDefaults";
import type { CrmDataProvider } from "../providers/types";
import type { OrganizationMember, OrganizationMemberFormData } from "../types";

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
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const ROLE_CHOICES = [
  { id: "accountant", label: "Accountant", description: "Approve hours, payroll, and payout workflows." },
  { id: "payroll_manager", label: "Payroll Manager", description: "Manage payroll runs and approve payroll operations." },
  { id: "hr", label: "HR", description: "Review people and employment-related data." },
  {
    id: "sales_manager",
    label: "Sales & CRM",
    description:
      "For your salespeople: contacts, projects/deals, and day-to-day CRM. Not a company admin — that stays on Administrator.",
  },
  { id: "manager", label: "Manager", description: "Operational access for team supervision (projects, time, and CRM where allowed)." },
  { id: "employee", label: "Employee", description: "Typical team member: time and HR-facing views as configured; limited CRM by default." },
] as const;

const ROLE_DISPLAY_LABELS: Record<string, string> = {
  accountant: "Accountant",
  payroll_manager: "Payroll",
  hr: "HR",
  sales_manager: "Sales & CRM",
  manager: "Manager",
  employee: "Employee",
};

type UserDialogState = { mode: "create" } | { mode: "edit"; sale: OrganizationMember };

type UserFormValues = OrganizationMemberFormData & { id?: number | string };

const normalizeRoles = (roles?: string[], administrator?: boolean) => {
  const unique = Array.from(new Set((roles ?? []).map((role) => String(role))));
  return administrator ? Array.from(new Set(["admin", ...unique])) : unique.filter((role) => role !== "admin");
};

const UserRolesInput = ({ disabled }: { disabled: boolean }) => {
  const { field } = useController<UserFormValues>({
    name: "roles",
    defaultValue: [],
  });

  const roles = Array.isArray(field.value) ? field.value : [];

  const toggleRole = (role: string, checked: boolean) => {
    const next = checked ? [...roles, role] : roles.filter((item) => item !== role);
    field.onChange(Array.from(new Set(next)));
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Roles</p>
        <p className="text-xs text-muted-foreground">
          Your company signs up once; the administrator invites teammates here. These roles are{" "}
          <span className="text-foreground">permissions</span> (payroll, HR, CRM, etc.) — not job titles
          in your org.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {ROLE_CHOICES.map((role) => (
          <label
            key={role.id}
            className="flex items-start gap-3 rounded-lg border p-3 text-sm"
          >
            <Checkbox
              checked={roles.includes(role.id)}
              disabled={disabled}
              onCheckedChange={(checked) => toggleRole(role.id, checked === true)}
            />
            <span className="space-y-1">
              <span className="block font-medium">{role.label}</span>
              <span className="block text-xs text-muted-foreground">{role.description}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
};

const UserFormFields = ({
  mode,
  disableAdministrator,
  currentIdentityId,
}: {
  mode: "create" | "edit";
  disableAdministrator: boolean;
  currentIdentityId?: string | number;
}) => {
  const { watch } = useFormContext<UserFormValues>();
  const administrator = watch("administrator");
  const currentId = watch("id");
  const isEditingSelf = currentId != null && String(currentId) === String(currentIdentityId ?? "");

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput source="first_name" validate={required()} helperText={false} />
        <TextInput source="last_name" validate={required()} helperText={false} />
      </div>
      <EmailInput source="email" validate={required()} helperText={false} />
      {mode === "create" ? (
        <TextInput source="password" type="password" validate={required()} helperText={false} />
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <BooleanInput
          source="administrator"
          helperText={false}
          readOnly={disableAdministrator || isEditingSelf}
        />
        <BooleanInput source="disabled" helperText={false} readOnly={isEditingSelf} />
      </div>
      <UserRolesInput disabled={administrator} />
      <p className="text-xs text-muted-foreground">
        {administrator
          ? "Administrator has full access and automatically carries the admin role."
          : "Use roles for payroll, accounting, and operational permissions without giving full access."}
      </p>
    </div>
  );
};

const UserDialog = ({
  open,
  onOpenChange,
  state,
  existingAdminId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: UserDialogState | null;
  existingAdminId?: number | string;
}) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const refresh = useRefresh();
  const { data: identity } = useGetIdentity();

  const sale = state?.mode === "edit" ? state.sale : undefined;
  const defaultValues = useMemo<UserFormValues>(
    () => ({
      id: sale?.id,
      first_name: sale?.first_name ?? "",
      last_name: sale?.last_name ?? "",
      email: sale?.email ?? "",
      password: "",
      administrator: sale?.administrator ?? false,
      roles: normalizeRoles(sale?.roles, sale?.administrator),
      disabled: sale?.disabled ?? false,
      avatar: sale?.avatar ?? null,
    }),
    [sale],
  );

  const disableAdministrator =
    existingAdminId != null &&
    (state?.mode === "create" || (sale != null && String(existingAdminId) !== String(sale.id)));

  const { mutate, isPending } = useMutation({
    mutationFn: async (values: UserFormValues) => {
      const payload = {
        ...values,
        roles: normalizeRoles(values.roles, values.administrator),
      };
      if (state?.mode === "edit" && sale) {
        return dataProvider.organizationMemberUpdate(sale.id, payload);
      }
      return dataProvider.organizationMemberCreate(payload);
    },
    onSuccess: () => {
      notify(state?.mode === "edit" ? "User updated successfully" : "User created successfully");
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{state.mode === "edit" ? "Edit user" : "New user"}</DialogTitle>
        </DialogHeader>
        <Form defaultValues={defaultValues} onSubmit={(values) => mutate(values as UserFormValues)} className="space-y-5">
          <UserFormFields
            mode={state.mode}
            disableAdministrator={disableAdministrator}
            currentIdentityId={identity?.id}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {state.mode === "edit" ? "Save" : "Create user"}
            </Button>
          </div>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

const RoleBadges = ({ sale }: { sale: OrganizationMember }) => {
  const roles = normalizeRoles(sale.roles, sale.administrator).filter((role) => role !== "admin");
  if (!roles.length) {
    return <span className="text-xs text-muted-foreground">No operational roles</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {roles.map((role) => (
        <span key={role} className="rounded-full border px-2 py-0.5 text-xs">
          {ROLE_DISPLAY_LABELS[role] ?? role.replaceAll("_", " ")}
        </span>
      ))}
    </div>
  );
};

const SectionIntro = ({ priceUsd }: { priceUsd: number }) => (
  <p className="text-sm text-muted-foreground">
    Each active person needs a paid seat. When you add someone new and you need another seat, this screen
    walks you to pay, then you can finish the invite. Price:{" "}
    <span className="text-foreground font-medium">{formatUsd(priceUsd)}</span> / user / month in Stripe
    (billed for licensed seats).
  </p>
);

export const UsersSettingsSection = () => {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dialogState, setDialogState] = useState<UserDialogState | null>(null);
  const [seatGateOpen, setSeatGateOpen] = useState(false);
  const [seatGateKind, setSeatGateKind] = useState<"plan" | "seats" | null>(null);
  const [payHandledCheckout, setPayHandledCheckout] = useState(false);

  const { data: identity, isPending: identityPending } = useGetIdentity();
  const isOrgAdmin = Boolean(
    identity && typeof identity === "object" && (identity as { administrator?: boolean }).administrator,
  );

  const { data: users = [], isPending } = useGetList<OrganizationMember>("organization_members", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "id", order: "ASC" },
  });

  const { data: orgRow, isLoading: orgLoading } = useQuery({
    queryKey: ["settings", "org_seat_gate"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select(
          "id, name, billable_seat_count, stripe_subscription_id, billing_status, price_per_seat_usd_monthly, stripe_customer_id",
        )
        .limit(1)
        .maybeSingle();
      if (error) {
        throw error;
      }
      return data;
    },
  });

  const dataProvider = useDataProvider<CrmDataProvider>();

  const priceUsd = Number(orgRow?.price_per_seat_usd_monthly ?? DEFAULT_SEAT_USD_PER_MONTH);
  const statusKey = (orgRow?.billing_status ?? "none").trim() || "none";
  const statusLabel = BILLING_STATUS_SHORT[statusKey] ?? statusKey;
  const licensed = orgRow?.billable_seat_count;
  const orgId = orgRow?.id;

  const activeUserCount = useMemo(() => users.filter((u) => !u.disabled).length, [users]);
  const licensedNum = typeof licensed === "number" && licensed > 0 ? licensed : 0;
  const monthlyByLicenses = licensedNum * priceUsd;
  const perUserLabel = formatUsd(priceUsd) + " / user / month";

  const needsActivePlan = useMemo(() => {
    if (orgRow == null) return false;
    const s = (orgRow.billing_status ?? "none").trim();
    return !orgRow.stripe_subscription_id || !BILLING_ALLOWS_SEATS.has(s);
  }, [orgRow]);

  const atLicensedSeatLimit = useMemo(() => {
    if (orgRow == null || orgRow.billable_seat_count == null) return false;
    return activeUserCount >= orgRow.billable_seat_count;
  }, [orgRow, activeUserCount]);

  const blockNewCheckout =
    Boolean(orgRow?.stripe_subscription_id) &&
    ["active", "trialing", "past_due", "incomplete", "unpaid", "paused"].includes(
      (orgRow?.billing_status ?? "").trim(),
    );
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
      queryClient.invalidateQueries({ queryKey: ["settings", "org_seat_gate"] });
      notify("Payment completed. You can add the new user now.", { type: "success" });
      if (searchParams.get("invite") === "1" || searchParams.get("invite") === "true") {
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
  }, [searchParams, isOrgAdmin, identityPending, notify, queryClient, clearCheckoutQueryParams, payHandledCheckout]);

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
      queryClient.invalidateQueries({ queryKey: ["settings", "org_seat_gate"] });
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
      await dataProvider.stripeBillingPortal({ orgId, returnPath: USERS_RETURN });
    },
    onError: (e: Error) => {
      notify(e.message || "Could not open billing", { type: "error" });
    },
  });

  const existingAdmin = users.find((user) => user.administrator);

  const onClickNewUser = () => {
    if (!isOrgAdmin) {
      notify("Only a company administrator can invite new users and manage seats.", { type: "warning" });
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
        notify("Open billing from the Manage button after you have a subscription, or try again in a moment.", {
          type: "info",
        });
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
                <th className="px-4 py-3">Roles</th>
                <th className="px-4 py-3">Seat / month</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((sale) => (
                <tr key={sale.id} className="border-b border-border/40 last:border-0 transition-colors hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {sale.first_name} {sale.last_name}
                    </div>
                    <div className="text-xs text-muted-foreground">{sale.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    {sale.administrator ? (
                      <span className="rounded-full border px-2 py-0.5 text-xs font-medium">
                        Administrator
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Standard user</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadges sale={sale} />
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums text-muted-foreground">
                    {licensed != null && orgRow ? formatUsd(priceUsd) + " /user/mo" : "—"}
                  </td>
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
                      onClick={() => setDialogState({ mode: "edit", sale })}
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
          : "No administrator found. Create one before assigning operational roles."}
      </div>
    </>
  );

  const billingStrip =
    isOrgAdmin && !orgLoading && orgRow ? (
      <div className="rounded-lg bg-muted/25 p-4 text-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Billing (workspace)</p>
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
              {perUserLabel} · <span className="text-muted-foreground">est. for licensed pool: </span>
              <span className="font-medium tabular-nums">{formatUsd(monthlyByLicenses)}</span> / month
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
                  {portalMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Card, invoices, cancel plan
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    ) : !isOrgAdmin ? (
      <p className="text-xs text-muted-foreground">
        Workspace billing and seats are only shown to a company <span className="text-foreground">administrator</span>.
      </p>
    ) : orgLoading ? (
      <p className="text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading billing…
      </p>
    ) : null;

  const payBusy =
    checkoutMutation.isPending || addOneSeatMutation.isPending || portalMutation.isPending;

  return (
    <>
      <div className="space-y-8 max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <h2 className="text-base font-semibold tracking-tight">Users &amp; roles</h2>
            <SectionIntro priceUsd={priceUsd} />
          </div>
          {isOrgAdmin ? (
            <Button type="button" className="shrink-0 self-start" onClick={onClickNewUser} disabled={orgLoading}>
              <Plus className="mr-2 h-4 w-4" />
              New user
            </Button>
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
              {seatGateKind === "plan" ? "Subscribe to add another user" : "Buy one more seat"}
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-1">
              {isOrgAdmin && seatGateKind === "plan" ? (
                <>
                  <span className="block">
                    Nomi bills per person. We’ll start secure checkout, then you’ll land back <strong>here</strong> to
                    open the <strong>New user</strong> form.
                  </span>
                  {canStartCheckout ? null : (
                    <span className="block text-amber-600 dark:text-amber-500">
                      You already have a subscription in a pending state. Use “Card, invoices” in this screen, or
                      “Manage in Stripe” from there.
                    </span>
                  )}
                </>
              ) : null}
              {isOrgAdmin && seatGateKind === "seats" ? (
                <span className="block">
                  You have <strong>{activeUserCount}</strong> of <strong>{licensed}</strong> licensed seats. Add
                  one more seat in Stripe, then the new-user form will open. About <strong>{perUserLabel}</strong> (prorated
                  in Stripe for this cycle).
                </span>
              ) : null}
              {!isOrgAdmin ? (
                <span className="block">
                  Your workspace administrator must add seats in <strong>Settings → Users &amp; roles</strong> before
                  you can invite.
                </span>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeSeatGate}>
              {seatGateKind === "plan" && isOrgAdmin && canStartCheckout ? "Not now" : "Close"}
            </Button>
            {isOrgAdmin && seatGateKind === "plan" && canStartCheckout ? (
              <Button type="button" onClick={onPrimarySeatAction} disabled={payBusy || orgId == null}>
                {checkoutMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Pay to subscribe
              </Button>
            ) : null}
            {isOrgAdmin && seatGateKind === "seats" && canAddOneInApp ? (
              <Button type="button" onClick={onPrimarySeatAction} disabled={payBusy || orgId == null}>
                {addOneSeatMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Add 1 seat &amp; continue
              </Button>
            ) : null}
            {isOrgAdmin && seatGateKind === "seats" && !canAddOneInApp && orgRow?.stripe_customer_id ? (
              <Button type="button" variant="secondary" onClick={() => portalMutation.mutate()} disabled={payBusy}>
                {portalMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Manage in Stripe
              </Button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <UserDialog
        open={dialogState != null}
        onOpenChange={(open) => {
          if (!open) setDialogState(null);
        }}
        state={dialogState}
        existingAdminId={existingAdmin?.id}
      />
    </>
  );
};
