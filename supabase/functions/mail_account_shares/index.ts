import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { memberIsOrgMailAdmin } from "../_shared/mailAccountShare.ts";

type ShareEntry = {
  member_id: number;
  can_view?: boolean;
  can_send?: boolean;
};

type Body = {
  action?: "get" | "set";
  account_id?: number;
  shares?: ShareEntry[];
};

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const user = await UserMiddleware(req);
    const member = await getUserOrganizationMember(user);
    if (!member) {
      return createErrorResponse(403, "Forbidden");
    }

    if (!memberIsOrgMailAdmin(member)) {
      return createErrorResponse(403, "Only admins can manage mailbox sharing");
    }

    const body = (await req.json()) as Body;
    const accountId = Number(body.account_id);
    if (!Number.isFinite(accountId)) {
      return createErrorResponse(400, "account_id is required");
    }

    const { data: account, error: accountError } = await supabaseAdmin
      .from("mail_accounts")
      .select("id, org_id, owner_member_id")
      .eq("id", accountId)
      .maybeSingle();

    if (accountError) {
      return createErrorResponse(500, accountError.message);
    }
    if (!account || account.org_id !== member.org_id) {
      return createErrorResponse(404, "Mailbox not found");
    }
    if (account.owner_member_id != null) {
      return createErrorResponse(400, "Only organization mailboxes can be shared");
    }

    if (body.action === "get") {
      const { data: shares, error } = await supabaseAdmin
        .from("mail_account_shares")
        .select(
          "member_id, can_view, can_send, granted_by_member_id, created_at, updated_at",
        )
        .eq("account_id", accountId)
        .order("member_id");

      if (error) {
        return createErrorResponse(500, error.message);
      }

      return json({ shares: shares ?? [] });
    }

    if (body.action === "set") {
      const entries = Array.isArray(body.shares) ? body.shares : [];
      const normalized = entries
        .map((entry) => ({
          member_id: Number(entry.member_id),
          can_view: entry.can_view !== false,
          can_send: entry.can_send === true,
        }))
        .filter(
          (entry) =>
            Number.isFinite(entry.member_id) &&
            entry.member_id !== member.id &&
            (entry.can_view || entry.can_send),
        );

      const memberIds = normalized.map((entry) => entry.member_id);
      if (memberIds.length > 0) {
        const { data: orgMembers, error: membersError } = await supabaseAdmin
          .from("organization_members")
          .select("id")
          .eq("org_id", member.org_id)
          .in("id", memberIds);

        if (membersError) {
          return createErrorResponse(500, membersError.message);
        }
        const validIds = new Set((orgMembers ?? []).map((row) => row.id));
        for (const id of memberIds) {
          if (!validIds.has(id)) {
            return createErrorResponse(400, "Invalid member in share list");
          }
        }
      }

      const { error: deleteError } = await supabaseAdmin
        .from("mail_account_shares")
        .delete()
        .eq("account_id", accountId);

      if (deleteError) {
        return createErrorResponse(500, deleteError.message);
      }

      if (normalized.length > 0) {
        const { error: insertError } = await supabaseAdmin
          .from("mail_account_shares")
          .insert(
            normalized.map((entry) => ({
              account_id: accountId,
              member_id: entry.member_id,
              can_view: entry.can_view,
              can_send: entry.can_send,
              granted_by_member_id: member.id,
            })),
          );

        if (insertError) {
          return createErrorResponse(500, insertError.message);
        }
      }

      const { data: shares, error: reloadError } = await supabaseAdmin
        .from("mail_account_shares")
        .select(
          "member_id, can_view, can_send, granted_by_member_id, created_at, updated_at",
        )
        .eq("account_id", accountId)
        .order("member_id");

      if (reloadError) {
        return createErrorResponse(500, reloadError.message);
      }

      return json({ shares: shares ?? [] });
    }

    return createErrorResponse(400, "Unknown action");
  } catch (error) {
    console.error("[mail_account_shares]", error);
    return createErrorResponse(
      500,
      error instanceof Error ? error.message : "Unexpected error",
    );
  }
});
