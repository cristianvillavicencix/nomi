import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { hasMemberCapability } from "../_shared/memberModulePermissions.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

type AccessEntryPasswordBody = {
  action?: "get" | "set" | "audit" | "migrate_legacy" | "legacy_count";
  entry_id?: number;
  password?: string | null;
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

const loadEntry = async (entryId: number) => {
  const { data, error } = await supabaseAdmin
    .from("deal_access_entries")
    .select("id, org_id, deal_id, has_password, password, password_encrypted")
    .eq("id", entryId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error("Access entry not found");
  }
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
  if (error) {
    throw new Error(error.message);
  }
  if (data !== true) {
    throw new Error("You do not have access to this project");
  }
};

const insertAudit = async (params: {
  orgId: number;
  entryId: number;
  dealId: number;
  memberId: number;
  action: "viewed" | "copied" | "updated" | "created" | "deleted";
  req: Request;
}) => {
  const { error } = await supabaseAdmin.from("deal_access_entry_audit").insert({
    org_id: params.orgId,
    entry_id: params.entryId,
    deal_id: params.dealId,
    member_id: params.memberId,
    action: params.action,
    ip_address: getClientIp(params.req),
    user_agent: params.req.headers.get("user-agent"),
  });
  if (error) {
    throw new Error(error.message);
  }
};

Deno.serve((req: Request) =>
  OptionsMiddleware(req, async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    return UserMiddleware(req, async (req, user) => {
      if (!user) {
        return createErrorResponse(401, "Unauthorized");
      }

      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return createErrorResponse(401, "Unauthorized");
      }

      const member = await getUserOrganizationMember(user);
      const orgId = member?.org_id != null ? Number(member.org_id) : null;
      const memberId = member?.id != null ? Number(member.id) : null;
      if (!orgId || !memberId) {
        return createErrorResponse(403, "Organization not found");
      }

      try {
        const body = (await req.json().catch(() => ({}))) as AccessEntryPasswordBody;
        const action = body.action ?? "get";

        if (action === "legacy_count") {
          if (!hasMemberCapability(member, "deal_operations.credentials.manage")) {
            return createErrorResponse(403, "Permission denied");
          }
          const { count, error } = await supabaseAdmin
            .from("deal_access_entries")
            .select("id", { count: "exact", head: true })
            .eq("org_id", orgId)
            .not("password", "is", null)
            .neq("password", "")
            .is("password_encrypted", null);
          if (error) {
            throw new Error(error.message);
          }
          return new Response(JSON.stringify({ count: count ?? 0 }), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        if (action === "migrate_legacy") {
          if (!hasMemberCapability(member, "deal_operations.credentials.manage")) {
            return createErrorResponse(403, "Permission denied");
          }
          const cryptoKey = getPgcryptoKey();
          const { data: legacyRows, error: legacyError } = await supabaseAdmin
            .from("deal_access_entries")
            .select("id, password")
            .eq("org_id", orgId)
            .not("password", "is", null)
            .neq("password", "")
            .is("password_encrypted", null);
          if (legacyError) {
            throw new Error(legacyError.message);
          }

          let migrated = 0;
          for (const row of legacyRows ?? []) {
            const plain = row.password?.trim();
            if (!plain) continue;
            const { error: rpcError } = await supabaseAdmin.rpc(
              "set_access_entry_password",
              {
                p_entry_id: row.id,
                p_password: plain,
                p_key: cryptoKey,
              },
            );
            if (rpcError) {
              throw new Error(rpcError.message);
            }
            migrated += 1;
          }

          return new Response(JSON.stringify({ migrated }), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        const entryId = body.entry_id != null ? Number(body.entry_id) : NaN;
        if (!Number.isFinite(entryId)) {
          return createErrorResponse(400, "entry_id is required");
        }

        const entry = await loadEntry(entryId);
        if (Number(entry.org_id) !== orgId) {
          return createErrorResponse(403, "Access entry not found");
        }

        await assertCanViewDeal(authHeader, Number(entry.deal_id));

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
            entryId,
            dealId: Number(entry.deal_id),
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
          if (!entry.has_password) {
            return new Response(JSON.stringify({ password: null }), {
              headers: { "Content-Type": "application/json", ...corsHeaders },
            });
          }

          const cryptoKey = getPgcryptoKey();
          const { data: password, error: getError } = await supabaseAdmin.rpc(
            "get_access_entry_password",
            { p_entry_id: entryId, p_key: cryptoKey },
          );
          if (getError) {
            throw new Error(getError.message);
          }

          await insertAudit({
            orgId,
            entryId,
            dealId: Number(entry.deal_id),
            memberId,
            action: "viewed",
            req,
          });

          return new Response(JSON.stringify({ password: password ?? null }), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        if (action === "set") {
          if (!hasMemberCapability(member, "deal_operations.credentials.manage")) {
            return createErrorResponse(403, "Permission denied");
          }
          const cryptoKey = getPgcryptoKey();
          const password =
            body.password != null && body.password.trim() !== ""
              ? body.password.trim()
              : null;

          const { error: setError } = await supabaseAdmin.rpc(
            "set_access_entry_password",
            {
              p_entry_id: entryId,
              p_password: password,
              p_key: cryptoKey,
            },
          );
          if (setError) {
            throw new Error(setError.message);
          }

          if (password) {
            await insertAudit({
              orgId,
              entryId,
              dealId: Number(entry.deal_id),
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
        const message =
          error instanceof Error ? error.message : "Request failed";
        return createErrorResponse(400, message);
      }
    });
  }),
);
