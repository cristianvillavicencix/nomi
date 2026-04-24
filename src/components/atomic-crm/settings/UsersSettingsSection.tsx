import { useMutation } from "@tanstack/react-query";
import { Edit, Plus } from "lucide-react";
import { Form, required, useDataProvider, useGetIdentity, useGetList, useNotify, useRefresh } from "ra-core";
import { useMemo, useState } from "react";
import { useController, useFormContext } from "react-hook-form";
import { BooleanInput } from "@/components/admin/boolean-input";
import { EmailInput } from "@/components/admin/email-input";
import { TextInput } from "@/components/admin/text-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CrmDataProvider } from "../providers/types";
import type { Sale, SalesFormData } from "../types";

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

/** Internal slugs in DB → short label in the user table (ids stay the same for compatibility). */
const ROLE_DISPLAY_LABELS: Record<string, string> = {
  accountant: "Accountant",
  payroll_manager: "Payroll",
  hr: "HR",
  sales_manager: "Sales & CRM",
  manager: "Manager",
  employee: "Employee",
};

type UserDialogState =
  | { mode: "create"; sale?: undefined }
  | { mode: "edit"; sale: Sale };

type UserFormValues = SalesFormData & { id?: number | string };

const normalizeRoles = (roles?: string[], administrator?: boolean) => {
  const unique = Array.from(new Set((roles ?? []).map((role) => String(role))));
  return administrator ? Array.from(new Set(["admin", ...unique])) : unique.filter((role) => role !== "admin");
};

const UserRolesInput = ({ disabled }: { disabled?: boolean }) => {
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
        return dataProvider.salesUpdate(sale.id, payload);
      }
      return dataProvider.salesCreate(payload);
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

const RoleBadges = ({ sale }: { sale: Sale }) => {
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

export const UsersSettingsSection = () => {
  const [dialogState, setDialogState] = useState<UserDialogState | null>(null);
  const { data: users = [], isPending } = useGetList<Sale>("sales", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "id", order: "ASC" },
  });

  const existingAdmin = users.find((user) => user.administrator);

  return (
    <>
      <Card id="users">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle>Users & Roles</CardTitle>
            <p className="text-sm text-muted-foreground">
              Each registered company has its own data. Invite users, assign what they can do, and
              keep contacts, people (employees, sales reps, subs) in one place.
            </p>
          </div>
          <Button type="button" onClick={() => setDialogState({ mode: "create" })}>
            <Plus className="mr-2 h-4 w-4" />
            New user
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {isPending ? (
            <p className="text-sm text-muted-foreground">Loading users…</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="border-b text-left">
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Access</th>
                    <th className="px-4 py-3">Roles</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((sale) => (
                    <tr key={sale.id} className="border-b last:border-b-0">
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
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground">
                          {sale.disabled ? "Disabled" : "Active"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button type="button" variant="outline" size="sm" onClick={() => setDialogState({ mode: "edit", sale })}>
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
          <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            {existingAdmin
              ? `Administrator account: ${existingAdmin.first_name} ${existingAdmin.last_name}`
              : "No administrator found. Create one before assigning operational roles."}
          </div>
        </CardContent>
      </Card>

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
