import type { User } from "jsr:@supabase/supabase-js@2";
import { supabaseAdmin } from "./supabaseAdmin.ts";
import { getUserSale } from "./getUserSale.ts";

export async function isPlatformOperator(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("platform_operators")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return false;
  return Boolean(data);
}

export async function countSalesForOrg(orgId: number) {
  const { count, error } = await supabaseAdmin
    .from("sales")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);
  if (error) return 0;
  return count ?? 0;
}

/**
 * User may act if they are a platform operator, or the org administrator for `orgId`.
 */
export async function assertPlatformOrOrgAdmin(user: User, orgId: number) {
  if (await isPlatformOperator(user.id)) {
    return;
  }
  const sale = await getUserSale(user);
  const sOrg = sale?.org_id != null ? Number(sale.org_id) : null;
  if (sale?.administrator === true && sOrg === orgId) {
    return;
  }
  throw new Error("Not authorized to manage billing for this organization");
}

export async function getPrimaryAdminEmail(orgId: number): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("sales")
    .select("email")
    .eq("org_id", orgId)
    .eq("administrator", true)
    .limit(1)
    .maybeSingle();
  if (data?.email && typeof data.email === "string") {
    return data.email.trim() || null;
  }
  const { data: anyUser } = await supabaseAdmin
    .from("sales")
    .select("email")
    .eq("org_id", orgId)
    .limit(1)
    .maybeSingle();
  if (anyUser?.email && typeof (anyUser as { email: string }).email === "string") {
    return (anyUser as { email: string }).email.trim() || null;
  }
  return null;
}
