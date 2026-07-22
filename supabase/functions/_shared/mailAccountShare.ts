import { supabaseAdmin } from "./supabaseAdmin.ts";

export type MailAccountShareRow = {
  member_id: number;
  can_view: boolean;
  can_send: boolean;
};

type ShareMember = {
  administrator: boolean | null;
  user_id: string;
  module_permissions?: Record<string, unknown> | null;
};

function memberHasCapability(member: ShareMember, capability: string): boolean {
  if (member.administrator) return true;
  if (member.user_id === "service_role") return true;
  const perms = member.module_permissions;
  if (!perms || typeof perms !== "object") return false;
  if (Array.isArray(perms)) return perms.includes(capability);
  if (Array.isArray((perms as { capabilities?: unknown }).capabilities)) {
    return ((perms as { capabilities: string[] }).capabilities).includes(
      capability,
    );
  }
  const val = (perms as Record<string, unknown>)[capability];
  return val === true || val === "allow" || val === "write";
}

export async function loadMailAccountShare(
  accountId: number,
  memberId: number,
): Promise<MailAccountShareRow | null> {
  const { data } = await supabaseAdmin
    .from("mail_account_shares")
    .select("member_id, can_view, can_send")
    .eq("account_id", accountId)
    .eq("member_id", memberId)
    .maybeSingle();
  return (data as MailAccountShareRow | null) ?? null;
}

export function memberIsOrgMailAdmin(member: ShareMember): boolean {
  if (member.administrator || member.user_id === "service_role") return true;
  return (
    memberHasCapability(member, "mail.org.manage") ||
    memberHasCapability(member, "mail.org.share")
  );
}

export async function assertOrgMailAccountAccess(
  member: ShareMember & { id: number },
  account: { id: number; org_id: number; owner_member_id: number | null },
  mode: "view" | "send" | "manage",
): Promise<string | null> {
  if (memberIsOrgMailAdmin(member)) {
    if (
      mode === "manage" &&
      !member.administrator &&
      member.user_id !== "service_role" &&
      !memberHasCapability(member, "mail.org.manage")
    ) {
      return "Forbidden";
    }
    return null;
  }

  const share = await loadMailAccountShare(account.id, member.id);
  if (mode === "view") {
    if (share?.can_view && memberHasCapability(member, "mail.org.view")) {
      return null;
    }
    return "Forbidden";
  }
  if (mode === "send") {
    if (share?.can_send && memberHasCapability(member, "mail.org.send")) {
      return null;
    }
    return "Forbidden";
  }
  return "Forbidden";
}
