export type StripeCredentialMode = "server" | "settings";
export type ClientCardPaymentStatus = "live" | "paused" | "not_configured";

export type StripeClientSettings = {
  org_id: number;
  stripe_credential_mode: StripeCredentialMode;
  credential_mode_label: string;
  invoice_payments_enabled: boolean;
  /** Mirrors invoice_payments_enabled (public invoice pages + short payment links). */
  payment_link_payments_enabled: boolean;
  proposal_payments_enabled: boolean;
  save_cards_default: boolean;
  configured: boolean;
  payment_status: ClientCardPaymentStatus;
  payment_status_label: string;
  credential_source: "database" | "environment" | "none";
  connection_label: string;
  server_keys_configured: boolean;
  settings_keys_configured: boolean;
  stripe_publishable_key: string | null;
  publishable_key_preview: string | null;
  publishable_key_configured: boolean;
  secret_key_configured: boolean;
  webhook_secret_configured: boolean;
  has_secret_key: boolean;
  has_webhook_secret: boolean;
  webhook_url: string | null;
};

export type StripeChannelKey =
  | "invoice_payments_enabled"
  | "proposal_payments_enabled"
  | "save_cards_default";
