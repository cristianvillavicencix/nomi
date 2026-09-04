import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { hasMemberCapability } from "../_shared/memberModulePermissions.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

type EnvVarBody = {
  action?: "get" | "set" | "set_many";
  var_id?: number;
  deal_id?: number;
  value?: string | null;
  vars?: Array<{
    key?: string;
    value?: string | null;
    is_secret?: boolean;
    sort_order?: number;
  }>;
};

const publishableKey =
  Deno.env.get("SB_PUBLISHABLE_KEY") ??
  Deno.env.get("PUBLISHABLE_KEY") ??
  Deno.env.get("SUPABASE_ANON_KEY") ??
  "";

const getPgcryptoKey = () => {
  const key = Deno.env.get("PGCRYPTO_KEY")?.trim();
  if (!key) {
    throw new Error("PGCRYPTO_KEY is not configured");
  }
  return key;
};

const assertCanViewDeal = async (authHeader: string, dealId: number) => {
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    publishableKey,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data, error } = await userClient.rpc("can_view_deal", {
    p_deal_id: dealId,
  });
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("You do not have access to this project");
};

const loadEnvVar = async (varId: number) => {
  const { data, error } = await supabaseAdmin
    .from("deal_env_vars")
    .select("id, org_id, deal_id, key, has_value, is_secret")
    .eq("id", varId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Env var not found");
  return data;
};

Deno.serve((req: Request) =>
  OptionsMiddleware(req, async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    return UserMiddleware(req, async (req, user) => {
      if (!user) return createErrorResponse(401, "Unauthorized");

      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return createErrorResponse(401, "Unauthorized");

      const member = await getUserOrganizationMember(user);
      const orgId = member?.org_id != null ? Number(member.org_id) : null;
      if (!orgId) {
        return createErrorResponse(403, "Organization not found");
      }

      try {
        const body = (await req.json().catch(() => ({}))) as EnvVarBody;
        const action = body.action ?? "get";

        if (action === "get") {
          if (
            !hasMemberCapability(member, "deal_operations.credentials.view")
          ) {
            return createErrorResponse(403, "Permission denied");
          }
          const varId = body.var_id != null ? Number(body.var_id) : NaN;
          if (!Number.isFinite(varId)) {
            return createErrorResponse(400, "var_id is required");
          }
          const row = await loadEnvVar(varId);
          if (Number(row.org_id) !== orgId) {
            return createErrorResponse(403, "Env var not found");
          }
          await assertCanViewDeal(authHeader, Number(row.deal_id));

          if (!row.has_value) {
            return new Response(JSON.stringify({ value: null }), {
              headers: { "Content-Type": "application/json", ...corsHeaders },
            });
          }

          const cryptoKey = getPgcryptoKey();
          const { data: value, error: getError } = await supabaseAdmin.rpc(
            "get_deal_env_var_value",
            { p_var_id: varId, p_key: cryptoKey },
          );
          if (getError) throw new Error(getError.message);

          return new Response(JSON.stringify({ value: value ?? null }), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        if (action === "set") {
          if (
            !hasMemberCapability(member, "deal_operations.credentials.manage")
          ) {
            return createErrorResponse(403, "Permission denied");
          }
          const varId = body.var_id != null ? Number(body.var_id) : NaN;
          if (!Number.isFinite(varId)) {
            return createErrorResponse(400, "var_id is required");
          }
          const row = await loadEnvVar(varId);
          if (Number(row.org_id) !== orgId) {
            return createErrorResponse(403, "Env var not found");
          }
          await assertCanViewDeal(authHeader, Number(row.deal_id));

          const cryptoKey = getPgcryptoKey();
          const value =
            body.value != null && String(body.value).trim() !== ""
              ? String(body.value)
              : null;
          const { error: setError } = await supabaseAdmin.rpc(
            "set_deal_env_var_value",
            { p_var_id: varId, p_value: value, p_key: cryptoKey },
          );
          if (setError) throw new Error(setError.message);

          return new Response(JSON.stringify({ ok: true }), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        if (action === "set_many") {
          if (
            !hasMemberCapability(member, "deal_operations.credentials.manage")
          ) {
            return createErrorResponse(403, "Permission denied");
          }
          const dealId = body.deal_id != null ? Number(body.deal_id) : NaN;
          if (!Number.isFinite(dealId)) {
            return createErrorResponse(400, "deal_id is required");
          }
          await assertCanViewDeal(authHeader, dealId);

          const { data: deal, error: dealError } = await supabaseAdmin
            .from("deals")
            .select("id, org_id")
            .eq("id", dealId)
            .maybeSingle();
          if (dealError) throw new Error(dealError.message);
          if (!deal || Number(deal.org_id) !== orgId) {
            return createErrorResponse(403, "Project not found");
          }

          const vars = Array.isArray(body.vars) ? body.vars : [];
          if (vars.length === 0) {
            return createErrorResponse(400, "vars is required");
          }

          const cryptoKey = getPgcryptoKey();
          const ids: number[] = [];
          for (let index = 0; index < vars.length; index += 1) {
            const entry = vars[index];
            const key = String(entry?.key ?? "").trim();
            if (!key) continue;
            const value =
              entry?.value != null ? String(entry.value) : "";
            const isSecret =
              entry?.is_secret != null
                ? Boolean(entry.is_secret)
                : /PASS|SECRET|KEY|TOKEN|PWD|PRIVATE/i.test(key);
            const sortOrder =
              entry?.sort_order != null && Number.isFinite(Number(entry.sort_order))
                ? Number(entry.sort_order)
                : index;

            const { data: varId, error: upsertError } = await supabaseAdmin.rpc(
              "upsert_deal_env_var",
              {
                p_deal_id: dealId,
                p_org_id: orgId,
                p_env_key: key,
                p_value: value,
                p_is_secret: isSecret,
                p_sort_order: sortOrder,
                p_crypto_key: cryptoKey,
              },
            );
            if (upsertError) throw new Error(upsertError.message);
            if (varId != null) ids.push(Number(varId));
          }

          return new Response(JSON.stringify({ ok: true, ids }), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        return createErrorResponse(400, "Invalid action");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Request failed";
        return createErrorResponse(400, message);
      }
    });
  }),
);
