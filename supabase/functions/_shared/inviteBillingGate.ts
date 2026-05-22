/** Mirrors `inviteBillingSeatGateDisabled()` in `src/platform/inviteBillingGate.ts`. */
export function inviteBillingSeatGateDisabled(): boolean {
  const raw = (Deno.env.get("SKIP_USER_INVITE_BILLING") ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}
