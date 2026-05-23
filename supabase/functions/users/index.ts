import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { assertSeatsAllowNewInvite } from "../_shared/billingAccess.ts";
import {
  deriveRolesFromModules,
  hasAnyOperationalModule,
  normalizeModulePermissions,
  type ModulePermissionRecord,
} from "../_shared/memberModulePermissions.ts";

const ALLOWED_ROLES = [
  "admin",
  "accountant",
  "payroll_manager",
  "hr",
  "sales_manager",
  "manager",
  "employee",
] as const;

function normalizeRoles(input: unknown, administrator: boolean) {
  const incoming = Array.isArray(input) ? input : [];
  const normalized = Array.from(
    new Set(
      incoming
        .map((role) =>
          String(role ?? "")
            .trim()
            .toLowerCase(),
        )
        .filter((role): role is (typeof ALLOWED_ROLES)[number] =>
          ALLOWED_ROLES.includes(role as (typeof ALLOWED_ROLES)[number]),
        ),
    ),
  );

  if (administrator && !normalized.includes("admin")) {
    normalized.unshift("admin");
  }

  if (!administrator) {
    return normalized.filter((role) => role !== "admin");
  }

  return normalized;
}

function saleOrgId(sale: { org_id?: number | null }): number {
  const v = sale?.org_id;
  if (v == null) return 1;
  const n = Number(v);
  return Number.isFinite(n) ? n : 1;
}

async function assertSingleAdministrator(
  user_id: string | null,
  administrator: boolean,
  org_id: number,
) {
  if (!administrator) return;

  const { data, error } = await supabaseAdmin
    .from("organization_members")
    .select("id, user_id")
    .eq("administrator", true)
    .eq("org_id", org_id);

  if (error) {
    console.error("Error checking administrator uniqueness:", error);
    throw error;
  }

  const otherAdmin = (data ?? []).find((sale) => sale.user_id !== user_id);
  if (otherAdmin) {
    throw new Error(
      "Only one administrator user is allowed in this organization",
    );
  }
}

async function updateSaleDisabled(user_id: string, disabled: boolean) {
  return await supabaseAdmin
    .from("organization_members")
    .update({ disabled: disabled ?? false })
    .eq("user_id", user_id);
}

async function persistMemberAccess(
  user_id: string,
  opts: {
    administrator: boolean;
    roles?: unknown;
    module_permissions?: unknown;
    enforceModuleChoice?: boolean;
  },
) {
  const {
    administrator,
    roles: rolesInput,
    module_permissions: modRaw,
    enforceModuleChoice,
  } = opts;

  const patch: Record<string, unknown> = { administrator };

  if (administrator) {
    patch.roles = normalizeRoles(rolesInput, true);
    patch.module_permissions = null;
  } else if (modRaw !== undefined) {
    const mod = normalizeModulePermissions(modRaw);
    if (enforceModuleChoice && !hasAnyOperationalModule(mod)) {
      throw new Error(
        "Select at least one access area for this user, or assign Administrator.",
      );
    }
    patch.roles = normalizeRoles(deriveRolesFromModules(mod), false);
    patch.module_permissions = mod;
  } else {
    patch.roles = normalizeRoles(rolesInput, false);
  }

  const { data: sales, error: salesError } = await supabaseAdmin
    .from("organization_members")
    .update(patch)
    .eq("user_id", user_id)
    .select("*");

  if (!sales?.length || salesError) {
    console.error("Error updating member access:", salesError);
    throw salesError ?? new Error("Failed to update organization member");
  }
  return sales.at(0);
}

async function createSale(
  user_id: string,
  org_id: number,
  data: {
    email: string;
    first_name: string;
    last_name: string;
    disabled: boolean;
    administrator: boolean;
    roles?: string[];
    module_permissions?: ModulePermissionRecord | null;
  },
) {
  const rest = data;

  const modulePermissionsStored = rest.administrator
    ? null
    : normalizeModulePermissions(data.module_permissions ?? {});
  const rolesFinal = rest.administrator
    ? normalizeRoles(data.roles, true)
    : normalizeRoles(deriveRolesFromModules(modulePermissionsStored), false);

  const { data: sales, error: salesError } = await supabaseAdmin
    .from("organization_members")
    .insert({
      email: rest.email,
      first_name: rest.first_name,
      last_name: rest.last_name,
      disabled: rest.disabled ?? false,
      administrator: rest.administrator,
      roles: rolesFinal,
      module_permissions: modulePermissionsStored,
      user_id,
      org_id,
    })
    .select("*");

  if (!sales?.length || salesError) {
    console.error("Error creating user:", salesError);
    throw salesError ?? new Error("Failed to create sale");
  }
  return sales.at(0);
}

async function updateSaleAvatar(user_id: string, avatar: unknown | null) {
  const { data: sales, error: salesError } = await supabaseAdmin
    .from("organization_members")
    .update({ avatar })
    .eq("user_id", user_id)
    .select("*");

  if (!sales?.length || salesError) {
    console.error("Error updating user:", salesError);
    throw salesError ?? new Error("Failed to update sale");
  }
  return sales.at(0);
}

async function updateSaleProfile(
  organization_member_id: number,
  profile: {
    email?: string;
    first_name?: string;
    last_name?: string;
  },
) {
  const updates = Object.fromEntries(
    Object.entries(profile).filter(([, value]) => value !== undefined),
  );

  if (Object.keys(updates).length === 0) {
    const { data: sale, error: salesError } = await supabaseAdmin
      .from("organization_members")
      .select("*")
      .eq("id", organization_member_id)
      .single();

    if (!sale || salesError) {
      console.error("Error fetching updated sale:", salesError);
      throw salesError ?? new Error("Failed to fetch sale");
    }

    return sale;
  }

  const { data: sale, error: salesError } = await supabaseAdmin
    .from("organization_members")
    .update(updates)
    .eq("id", organization_member_id)
    .select("*")
    .single();

  if (!sale || salesError) {
    console.error("Error updating sale profile:", salesError);
    throw salesError ?? new Error("Failed to update sale");
  }

  return sale;
}

function isAuthEmailAlreadyUsed(
  error: { code?: string; message?: string } | null,
) {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  return (
    error.code === "email_exists" ||
    msg.includes("already been registered") ||
    msg.includes("already registered") ||
    msg.includes("user already")
  );
}

async function finalizeInvitedMember(
  user_id: string,
  opts: {
    disabled: boolean;
    administrator: boolean;
    roles?: unknown;
    validatedModules?: ModulePermissionRecord;
  },
) {
  const { disabled, administrator, roles, validatedModules } = opts;
  await updateSaleDisabled(user_id, disabled);
  return await persistMemberAccess(user_id, {
    administrator,
    roles,
    module_permissions: administrator ? undefined : validatedModules,
    enforceModuleChoice: !administrator,
  });
}

function normalizeInviteEmail(email: unknown): string {
  return String(email ?? "")
    .trim()
    .toLowerCase();
}

function getSetPasswordRedirectUrl(req: Request) {
  const origin =
    req.headers.get("origin") ??
    Deno.env.get("BILLING_PUBLIC_SITE_URL") ??
    "https://www.nomicrm.com";
  return new URL("/set-password", origin).toString();
}

async function getOrgMemberByEmail(email: string, org_id: number) {
  const { data, error } = await supabaseAdmin
    .from("organization_members")
    .select("*")
    .eq("org_id", org_id)
    .ilike("email", email)
    .maybeSingle();
  if (error) {
    console.error("getOrgMemberByEmail", error);
    throw error;
  }
  return data;
}

async function sendInviteOrSetPasswordEmail(
  email: string,
  metadata: Record<string, string>,
  redirectTo: string,
) {
  const { error: inviteError } =
    await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: metadata,
      redirectTo,
    });
  if (!inviteError) return null;

  if (!isAuthEmailAlreadyUsed(inviteError)) {
    console.error("sendInviteOrSetPasswordEmail invite", inviteError);
    return inviteError;
  }

  // Auth user already exists (pending invite or old signup) — send set-password mail.
  const { error: recoveryError } =
    await supabaseAdmin.auth.resetPasswordForEmail(email, { redirectTo });
  if (recoveryError) {
    console.error("sendInviteOrSetPasswordEmail recovery", recoveryError);
    return recoveryError;
  }
  return null;
}

async function inviteUser(req: Request, currentOrgMember: any) {
  const body = await req.json();
  const {
    email: rawEmail,
    first_name,
    last_name,
    disabled,
    administrator,
    roles,
    module_permissions,
  } = body;
  const email = normalizeInviteEmail(rawEmail);

  if (!currentOrgMember.administrator) {
    return createErrorResponse(401, "Not Authorized");
  }

  const orgId = saleOrgId(currentOrgMember);

  let validatedModules: ModulePermissionRecord | undefined;
  if (!administrator) {
    validatedModules = normalizeModulePermissions(module_permissions);
    if (!hasAnyOperationalModule(validatedModules)) {
      return createErrorResponse(
        400,
        "Select at least one access area for this user, or assign Administrator.",
      );
    }
  }

  try {
    await assertSingleAdministrator(null, administrator, orgId);
  } catch (error) {
    return createErrorResponse(400, (error as Error).message);
  }

  const inviteMetadata = {
    first_name,
    last_name,
    org_id: String(orgId),
  };
  const setPasswordRedirect = getSetPasswordRedirectUrl(req);

  let existingInOrg: Awaited<ReturnType<typeof getOrgMemberByEmail>> = null;
  try {
    existingInOrg = await getOrgMemberByEmail(email, orgId);
  } catch {
    return createErrorResponse(500, "Internal Server Error");
  }

  if (existingInOrg) {
    try {
      await assertSingleAdministrator(
        existingInOrg.user_id,
        administrator,
        orgId,
      );
    } catch (error) {
      return createErrorResponse(400, (error as Error).message);
    }

    const { data: authData, error: authLookupError } =
      await supabaseAdmin.auth.admin.getUserById(existingInOrg.user_id);
    if (authLookupError || !authData?.user) {
      console.error("inviteUser existing member auth lookup", authLookupError);
      return createErrorResponse(500, "Internal Server Error");
    }

    if (authData.user.email_confirmed_at) {
      return createErrorResponse(
        400,
        "This person is already on your team. Use Edit on the user list to change their access.",
        { code: "MEMBER_ALREADY_ACTIVE" },
      );
    }

    try {
      await updateSaleProfile(existingInOrg.id, {
        email,
        first_name,
        last_name,
      });
      const saleRow = await finalizeInvitedMember(existingInOrg.user_id, {
        disabled,
        administrator,
        roles,
        validatedModules,
      });
      const resendError = await sendInviteOrSetPasswordEmail(
        email,
        inviteMetadata,
        setPasswordRedirect,
      );
      if (resendError) {
        return createErrorResponse(
          500,
          "User updated but the invitation email could not be sent. Try again in a moment.",
        );
      }

      return new Response(
        JSON.stringify({
          data: saleRow,
        }),
        {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    } catch (error) {
      return createErrorResponse(
        (error as any).status ?? 500,
        (error as Error).message,
        {
          code: (error as any).code,
        },
      );
    }
  }

  try {
    await assertSeatsAllowNewInvite(orgId);
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.startsWith("SUBSCRIBE_FIRST:")) {
      return createErrorResponse(400, msg.replace(/^SUBSCRIBE_FIRST:\s*/, ""), {
        code: "SUBSCRIBE_FIRST",
      });
    }
    if (msg.startsWith("SEAT_LIMIT:")) {
      return createErrorResponse(400, msg.replace(/^SEAT_LIMIT:\s*/, ""), {
        code: "SEAT_LIMIT",
      });
    }
    if (msg === "Organization not found") {
      return createErrorResponse(404, msg);
    }
    return createErrorResponse(500, msg);
  }

  const { data: inviteData, error: inviteError } =
    await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: inviteMetadata,
      redirectTo: setPasswordRedirect,
    });

  let user = inviteData?.user;

  if (inviteError) {
    if (!isAuthEmailAlreadyUsed(inviteError)) {
      console.error(`Error inviting user: invite_error=${inviteError}`);
      return createErrorResponse(
        inviteError.status ?? 500,
        inviteError.message || "Failed to send invitation mail",
        { code: inviteError.code },
      );
    }

    const { data: existingAuthRows, error: lookupError } =
      await supabaseAdmin.rpc("get_user_id_by_email", { email });

    if (!existingAuthRows?.length || lookupError) {
      console.error(
        `Error inviting user: error=${lookupError ?? "could not fetch users for email"}`,
      );
      return createErrorResponse(500, "Internal Server Error");
    }

    user = existingAuthRows[0];

    try {
      const { data: existingSale, error: salesError } = await supabaseAdmin
        .from("organization_members")
        .select("*")
        .eq("user_id", user.id);
      if (salesError) {
        return createErrorResponse(salesError.status, salesError.message, {
          code: salesError.code,
        });
      }
      if (existingSale.length > 0) {
        const existing = existingSale[0];
        if (saleOrgId(existing) === orgId) {
          try {
            await assertSingleAdministrator(user.id, administrator, orgId);
            await updateSaleProfile(existing.id, {
              email,
              first_name,
              last_name,
            });
            const saleRow = await finalizeInvitedMember(user.id, {
              disabled,
              administrator,
              roles,
              validatedModules,
            });
            const mailError = await sendInviteOrSetPasswordEmail(
              email,
              inviteMetadata,
              setPasswordRedirect,
            );
            if (mailError) {
              return createErrorResponse(
                500,
                "User updated but the invitation email could not be sent. Try again in a moment.",
              );
            }
            return new Response(JSON.stringify({ data: saleRow }), {
              headers: { "Content-Type": "application/json", ...corsHeaders },
            });
          } catch (error) {
            return createErrorResponse(
              (error as any).status ?? 500,
              (error as Error).message,
              { code: (error as any).code },
            );
          }
        }

        const { data: otherOrg } = await supabaseAdmin
          .from("organizations")
          .select("name")
          .eq("id", saleOrgId(existing))
          .maybeSingle();
        const otherOrgName = otherOrg?.name?.trim() || "another workspace";
        const { data: authRow } = await supabaseAdmin.auth.admin.getUserById(
          user.id,
        );
        const companyName = String(
          authRow?.user?.user_metadata?.company_name ?? "",
        ).trim();
        const signupHint = companyName
          ? ` They may have registered on the sign-up page with company “${companyName}” instead of using your invitation.`
          : "";

        return createErrorResponse(
          400,
          `This email is already linked to “${otherOrgName}”.${signupHint} Use a different email, or remove that account before inviting again.`,
          { code: "MEMBER_OTHER_WORKSPACE" },
        );
      }

      const saleRow = await createSale(user.id, orgId, {
        email,
        first_name,
        last_name,
        disabled,
        administrator,
        roles,
        module_permissions: administrator ? null : validatedModules!,
      });

      const mailError = await sendInviteOrSetPasswordEmail(
        email,
        inviteMetadata,
        setPasswordRedirect,
      );
      if (mailError) {
        return createErrorResponse(
          500,
          "User was added but the invitation email could not be sent. Try again in a moment.",
        );
      }

      return new Response(
        JSON.stringify({
          data: saleRow,
        }),
        {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    } catch (error) {
      return createErrorResponse(
        (error as any).status ?? 500,
        (error as Error).message,
        {
          code: (error as any).code,
        },
      );
    }
  }

  if (!user) {
    console.error("Error inviting user: undefined user after invite");
    return createErrorResponse(500, "Internal Server Error");
  }

  try {
    const saleRow = await finalizeInvitedMember(user.id, {
      disabled,
      administrator,
      roles,
      validatedModules,
    });

    return new Response(
      JSON.stringify({
        data: saleRow,
      }),
      {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (e) {
    console.error("Error patching sale:", e);
    const msg = (e as Error)?.message ?? "";
    const isAdminConflict = msg.includes(
      "Only one administrator user is allowed",
    );
    return createErrorResponse(
      isAdminConflict ? 400 : 500,
      (e as Error).message || "Internal Server Error",
    );
  }
}

async function patchUser(req: Request, currentOrgMember: any) {
  const body = await req.json();
  const hasModulePayload = Object.prototype.hasOwnProperty.call(
    body,
    "module_permissions",
  );
  const {
    organization_member_id,
    email,
    first_name,
    last_name,
    avatar,
    administrator,
    roles,
    disabled,
  } = body;
  const { data: sale } = await supabaseAdmin
    .from("organization_members")
    .select("*")
    .eq("id", organization_member_id)
    .single();

  if (!sale) {
    return createErrorResponse(404, "Not Found");
  }

  // Users can only update their own profile unless they are an administrator
  if (!currentOrgMember.administrator && currentOrgMember.id !== sale.id) {
    return createErrorResponse(401, "Not Authorized");
  }

  if (currentOrgMember.administrator) {
    if (saleOrgId(sale) !== saleOrgId(currentOrgMember)) {
      return createErrorResponse(403, "Not Authorized");
    }
  }

  const { data, error: userError } =
    await supabaseAdmin.auth.admin.updateUserById(sale.user_id, {
      email,
      ban_duration: disabled ? "87600h" : "none",
      user_metadata: {
        first_name,
        last_name,
        org_id: String(saleOrgId(sale)),
      },
    });

  if (!data?.user || userError) {
    console.error("Error patching user:", userError);
    return createErrorResponse(500, "Internal Server Error");
  }

  try {
    await updateSaleProfile(organization_member_id, {
      email,
      first_name,
      last_name,
    });
  } catch (e) {
    console.error("Error patching sale profile:", e);
    return createErrorResponse(500, "Internal Server Error");
  }

  if ("avatar" in body) {
    await updateSaleAvatar(data.user.id, avatar ?? null);
  }

  // Only administrators can update the administrator and disabled status
  if (!currentOrgMember.administrator) {
    const { data: new_sale } = await supabaseAdmin
      .from("organization_members")
      .select("*")
      .eq("id", organization_member_id)
      .single();
    return new Response(
      JSON.stringify({
        data: new_sale,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      },
    );
  }

  try {
    const nextAdministrator =
      typeof body.administrator === "boolean"
        ? body.administrator
        : Boolean(sale.administrator);

    await assertSingleAdministrator(
      data.user.id,
      nextAdministrator,
      saleOrgId(sale),
    );
    await updateSaleDisabled(data.user.id, disabled);

    const updatedMember = await persistMemberAccess(data.user.id, {
      administrator: nextAdministrator,
      roles,
      module_permissions: hasModulePayload
        ? body.module_permissions
        : undefined,
      enforceModuleChoice: Boolean(
        hasModulePayload && nextAdministrator !== true,
      ),
    });
    return new Response(
      JSON.stringify({
        data: updatedMember,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      },
    );
  } catch (e) {
    console.error("Error patching sale:", e);
    const msg = (e as Error)?.message ?? "";
    const isAdminConflict = msg.includes(
      "Only one administrator user is allowed",
    );
    return createErrorResponse(
      isAdminConflict ? 400 : 500,
      (e as Error).message || "Internal Server Error",
    );
  }
}

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) =>
    AuthMiddleware(req, async (req) =>
      UserMiddleware(req, async (req, user) => {
        const currentOrgMember = await getUserOrganizationMember(user);
        if (!currentOrgMember) {
          return createErrorResponse(
            403,
            "No hay un perfil de miembro vinculado a esta cuenta. Inicia sesión con un usuario de tu organización o pide a un administrador que te invite de nuevo.",
          );
        }

        if (req.method === "POST") {
          return inviteUser(req, currentOrgMember);
        }

        if (req.method === "PATCH") {
          return patchUser(req, currentOrgMember);
        }

        return createErrorResponse(405, "Method Not Allowed");
      }),
    ),
  ),
);
