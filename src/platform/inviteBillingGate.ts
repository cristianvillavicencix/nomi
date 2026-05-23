/**
 * Seat / subscription checks around inviting users (edge + Users settings UI).
 *
 * Internal deployments often keep Stripe configured for future billing but skip
 * per-seat invites. Set BOTH:
 * - `SKIP_USER_INVITE_BILLING=1` (Supabase Edge Function secrets, e.g. `users`)
 * - `VITE_SKIP_USER_INVITE_BILLING=1` (Vite env at build time)
 */
export function inviteBillingSeatGateDisabled(): boolean {
  const raw = String(import.meta.env.VITE_SKIP_USER_INVITE_BILLING ?? "")
    .trim()
    .toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}
