import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { hasMemberCapability } from "../_shared/memberModulePermissions.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

type DealSecretValueBody = {
  action?: "get" | "set" | "audit";
  secret_id?: number;
  value?: string | null;
  audit_action?: "viewed" | "copied" | "created" | "updated" | "deleted";
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

const getClientIp = (req: Request) =>
  req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
  req.headers.get("x-real-ip") ??
  null;

const loadSecret = async (secretId: number) => {
  const { data, error } = await supabaseAdmin
    .from("deal_secrets")
    .select("id, org_id, deal_id, has_secret")
    .eq("id", secretId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Secret not found");
  return data;
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

const insertAudit = async (params: {
  orgId: number;
  secretId: number;
  dealId: number;
  memberId: number;
  action: "viewed" | "copied" | "updated" | "created" | "deleted";
  req: Request;
}) => {
  const { error } = await supabaseAdmin.from("deal_secret_audit").insert({
    org_id: params.orgId,
    secret_id: params.secretId,
    deal_id: params.dealId,
    member_id: params.memberId,
    action: params.action,
    ip_address: getClientIp(params.req),
    user_agent: params.req.headers.get("user-agent"),
  });
  if (error) throw new Error(error.message);
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
      const memberId = member?.id != null ? Number(member.id) : null;
      if (!orgId || !memberId) {
        return createErrorResponse(403, "Organization not found");
      }

      try {
        const body = (await req.json().catch(() => ({}))) as DealSecretValueBody;
        const action = body.action ?? "get";

        const secretId = body.secret_id != null ? Number(body.secret_id) : NaN;
        if (!Number.isFinite(secretId)) {
          return createErrorResponse(400, "secret_id is required");
        }

        const secret = await loadSecret(secretId);
        if (Number(secret.org_id) !== orgId) {
          return createErrorResponse(403, "Secret not found");
        }

        await assertCanViewDeal(authHeader, Number(secret.deal_id));

        if (action === "audit") {
          if (!hasMemberCapability(member, "deal_operations.credentials.view")) {
            return createErrorResponse(403, "Permission denied");
          }
          const auditAction = body.audit_action;
          if (
            auditAction !== "viewed" &&
            auditAction !== "copied" &&
            auditAction !== "created" &&
            auditAction !== "updated" &&
            auditAction !== "deleted"
          ) {
            return createErrorResponse(400, "Invalid audit_action");
          }
          await insertAudit({
            orgId,
            secretId,
            dealId: Number(secret.deal_id),
            memberId,
            action: auditAction,
            req,
          });
          return new Response(JSON.stringify({ ok: true }), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        if (action === "get") {
          if (!hasMemberCapability(member, "deal_operations.credentials.view")) {
            return createErrorResponse(403, "Permission denied");
          }
          if (!secret.has_secret) {
            return new Response(JSON.stringify({ value: null }), {
              headers: { "Content-Type": "application/json", ...corsHeaders },
            });
          }

          const cryptoKey = getPgcryptoKey();
          const { data: value, error: getError } = await supabaseAdmin.rpc(
            "get_deal_secret_value",
            { p_secret_id: secretId, p_key: cryptoKey },
          );
          if (getError) throw new Error(getError.message);

          await insertAudit({
            orgId,
            secretId,
            dealId: Number(secret.deal_id),
            memberId,
            action: "viewed",
            req,
          });

          return new Response(JSON.stringify({ value: value ?? null }), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        if (action === "set") {
          if (!hasMemberCapability(member, "deal_operations.credentials.manage")) {
            return createErrorResponse(403, "Permission denied");
          }
          const cryptoKey = getPgcryptoKey();
          const value =
            body.value != null && body.value.trim() !== "" ? body.value.trim() : null;

          const { error: setError } = await supabaseAdmin.rpc(
            "set_deal_secret_value",
            { p_secret_id: secretId, p_value: value, p_key: cryptoKey },
          );
          if (setError) throw new Error(setError.message);

          if (value) {
            await insertAudit({
              orgId,
              secretId,
              dealId: Number(secret.deal_id),
              memberId,
              action: "updated",
              req,
            });
          }

          return new Response(JSON.stringify({ ok: true }), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        return createErrorResponse(400, "Invalid action");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Request failed";
        return createErrorResponse(400, message);
      }
    });
  }),
);

