-- Clear stale setup links on subscriptions that are already active in Stripe.

update public.client_subscriptions
set
  setup_share_url = null,
  setup_short_code = null,
  setup_checkout_url = null,
  stripe_checkout_session_id = null
where status in ('active', 'trialing')
  and (
    setup_share_url is not null
    or setup_short_code is not null
    or setup_checkout_url is not null
    or stripe_checkout_session_id is not null
  );
