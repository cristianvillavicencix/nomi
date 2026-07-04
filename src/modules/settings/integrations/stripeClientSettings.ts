export type ClientCardPaymentStatus = "live" | "paused" | "not_configured";

export type StripeClientSettings = {
  org_id: number;
  client_payments_enabled: boolean;
  configured: boolean;
  payment_status: ClientCardPaymentStatus;
  payment_status_label: string;
  credential_source: "database" | "environment" | "none";
  connection_label: string;
  stripe_publishable_key: string | null;
  publishable_key_preview: string | null;
  publishable_key_configured: boolean;
  secret_key_configured: boolean;
  webhook_secret_configured: boolean;
  has_secret_key: boolean;
  has_webhook_secret: boolean;
  webhook_url: string | null;
};
