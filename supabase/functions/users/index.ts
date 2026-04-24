import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { getUserSale } from "../_shared/getUserSale.ts";

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
        .map((role) => String(role ?? "").trim().toLowerCase())
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
    .from("sales")
    .select("id, user_id")
    .eq("administrator", true)
    .eq("org_id", org_id);

  if (error) {
    console.error("Error checking administrator uniqueness:", error);
    throw error;
  }

  const otherAdmin = (data ?? []).find((sale) => sale.user_id !== user_id);
  if (otherAdmin) {
    throw new Error("Only one administrator user is allowed in this organization");
  }
}

async function updateSaleDisabled(user_id: string, disabled: boolean) {
  return await supabaseAdmin
    .from("sales")
    .update({ disabled: disabled ?? false })
    .eq("user_id", user_id);
}

async function updateSaleAdministrator(
  user_id: string,
  administrator: boolean,
  roles?: string[],
) {
  const { data: sales, error: salesError } = await supabaseAdmin
    .from("sales")
    .update({ administrator, roles: normalizeRoles(roles, administrator) })
    .eq("user_id", user_id)
    .select("*");

  if (!sales?.length || salesError) {
    console.error("Error updating user:", salesError);
    throw salesError ?? new Error("Failed to update sale");
  }
  return sales.at(0);
}

async function createSale(
  user_id: string,
  org_id: number,
  data: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    disabled: boolean;
    administrator: boolean;
    roles?: string[];
  },
) {
  const { password: _password, ...rest } = data;
  const { data: sales, error: salesError } = await supabaseAdmin
    .from("sales")
    .insert({
      ...rest,
      roles: normalizeRoles(data.roles, data.administrator),
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
    .from("sales")
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
  sales_id: number,
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
      .from("sales")
      .select("*")
      .eq("id", sales_id)
      .single();

    if (!sale || salesError) {
      console.error("Error fetching updated sale:", salesError);
      throw salesError ?? new Error("Failed to fetch sale");
    }

    return sale;
  }

  const { data: sale, error: salesError } = await supabaseAdmin
    .from("sales")
    .update(updates)
    .eq("id", sales_id)
    .select("*")
    .single();

  if (!sale || salesError) {
    console.error("Error updating sale profile:", salesError);
    throw salesError ?? new Error("Failed to update sale");
  }

  return sale;
}

async function inviteUser(req: Request, currentUserSale: any) {
  const {
    email,
    password,
    first_name,
    last_name,
    disabled,
    administrator,
    roles,
  } = await req.json();

  if (!currentUserSale.administrator) {
    return createErrorResponse(401, "Not Authorized");
  }

  const orgId = saleOrgId(currentUserSale);

  try {
    await assertSingleAdministrator(null, administrator, orgId);
  } catch (error) {
    return createErrorResponse(400, (error as Error).message);
  }

  const { data, error: userError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    user_metadata: {
      first_name,
      last_name,
      org_id: String(orgId),
    },
  });

  let user = data?.user;

  if (!user && userError?.code === "email_exists") {
    // This may happen if users cleared their database but not the users
    // We have to create the sale directly
    const { data, error } = await supabaseAdmin.rpc("get_user_id_by_email", {
      email,
    });

    if (!data || error) {
      console.error(
        `Error inviting user: error=${error ?? "could not fetch users for email"}`,
      );
      return createErrorResponse(500, "Internal Server Error");
    }

    user = data[0];
    try {
      const { data: existingSale, error: salesError } = await supabaseAdmin
        .from("sales")
        .select("*")
        .eq("user_id", user.id);
      if (salesError) {
        return createErrorResponse(salesError.status, salesError.message, {
          code: salesError.code,
        });
      }
      if (existingSale.length > 0) {
        return createErrorResponse(
          400,
          "A sales for this email already exists",
        );
      }

      const sale = await createSale(user.id, orgId, {
        email,
        password,
        first_name,
        last_name,
        disabled,
        administrator,
        roles,
      });

      return new Response(
        JSON.stringify({
          data: sale,
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
  } else {
    if (userError) {
      console.error(`Error inviting user: user_error=${userError}`);
      return createErrorResponse(userError.status, userError.message, {
        code: userError.code,
      });
    }
    if (!data?.user) {
      console.error("Error inviting user: undefined user");
      return createErrorResponse(500, "Internal Server Error");
    }
    const { error: emailError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: {
          first_name,
          last_name,
          org_id: String(orgId),
        },
      });

    if (emailError) {
      console.error(`Error inviting user, email_error=${emailError}`);
      return createErrorResponse(500, "Failed to send invitation mail");
    }
  }

  try {
    await updateSaleDisabled(user.id, disabled);
    const sale = await updateSaleAdministrator(user.id, administrator, roles);

    return new Response(
      JSON.stringify({
        data: sale,
      }),
      {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (e) {
    console.error("Error patching sale:", e);
    const msg = (e as Error)?.message ?? "";
    const isAdminConflict = msg.includes("Only one administrator user is allowed");
    return createErrorResponse(
      isAdminConflict ? 400 : 500,
      (e as Error).message || "Internal Server Error",
    );
  }
}

async function patchUser(req: Request, currentUserSale: any) {
  const body = await req.json();
  const {
    sales_id,
    email,
    first_name,
    last_name,
    avatar,
    administrator,
    roles,
    disabled,
  } = body;
  const { data: sale } = await supabaseAdmin
    .from("sales")
    .select("*")
    .eq("id", sales_id)
    .single();

  if (!sale) {
    return createErrorResponse(404, "Not Found");
  }

  // Users can only update their own profile unless they are an administrator
  if (!currentUserSale.administrator && currentUserSale.id !== sale.id) {
    return createErrorResponse(401, "Not Authorized");
  }

  if (currentUserSale.administrator) {
    if (saleOrgId(sale) !== saleOrgId(currentUserSale)) {
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
    await updateSaleProfile(sales_id, {
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
  if (!currentUserSale.administrator) {
    const { data: new_sale } = await supabaseAdmin
      .from("sales")
      .select("*")
      .eq("id", sales_id)
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
    await assertSingleAdministrator(
      data.user.id,
      administrator,
      saleOrgId(sale),
    );
    await updateSaleDisabled(data.user.id, disabled);
    const sale = await updateSaleAdministrator(data.user.id, administrator, roles);
    return new Response(
      JSON.stringify({
        data: sale,
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
    const isAdminConflict = msg.includes("Only one administrator user is allowed");
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
        const currentUserSale = await getUserSale(user);
        if (!currentUserSale) {
          return createErrorResponse(401, "Unauthorized");
        }

        if (req.method === "POST") {
          return inviteUser(req, currentUserSale);
        }

        if (req.method === "PATCH") {
          return patchUser(req, currentUserSale);
        }

        return createErrorResponse(405, "Method Not Allowed");
      }),
    ),
  ),
);
