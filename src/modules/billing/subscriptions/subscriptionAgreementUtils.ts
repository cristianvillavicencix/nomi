/** Pure gate for agreement auto-activation after card setup (no Stripe). */
export const shouldAutoActivateAgreementEnrollment = (subscription: {
  enrollment_mode?: string | null;
  agreement_signed_at?: string | null;
  stripe_subscription_id?: string | null;
  status?: string | null;
}) =>
  (subscription.enrollment_mode ?? "direct") === "agreement" &&
  Boolean(subscription.agreement_signed_at) &&
  !subscription.stripe_subscription_id?.trim() &&
  subscription.status === "pending_setup";
