import { type User } from "jsr:@supabase/supabase-js@2";
import { supabaseAdmin } from "./supabaseAdmin.ts";

/** `public.organization_members` row for the auth user (CRM member / login profile). */
export const getUserOrganizationMember = async (user: User) => {
  return (
    await supabaseAdmin
      .from("organization_members")
      .select("*")
      .eq("user_id", user.id)
      .single()
  )?.data;
};
