import { supabaseAdmin } from "./supabaseAdmin.ts";

export type StripeCredentialMode = "server" | "settings";
export type ClientCardPaymentStatus = "live" | "paused" | "not_configured";

export type StripeClientSettingsPublic = {
  org_id: number;
  stripe_credential_mode: StripeCredentialMode;
  credential_mode_label: string;
  invoice_payments_enabled: boolean;
  /** Kept in sync with invoice_payments_enabled (pages + short payment links). */
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

type OrgStripeRow = {
  client_billing_mode: string;
  stripe_credential_mode: string | null;
  stripe_invoice_payments_enabled: boolean | null;
  stripe_payment_link_payments_enabled: boolean | null;
  stripe_proposal_payments_enabled: boolean | null;
  stripe_save_cards_default: boolean | null;
  stripe_publishable_key: string | null;
  stripe_secret_key_encrypted: string | null;
  stripe_client_webhook_secret_encrypted: string | null;
};

const getPgcryptoKey = () => Deno.env.get("PGCRYPTO_KEY")?.trim() ?? "";

const getClientWebhookUrl = () => {
  const base = Deno.env.get("SUPABASE_URL")?.trim();
  if (!base) return null;
  return `${base}/functions/v1/stripe-client-webhook`;
};

const envSecretKey = () => Deno.env.get("STRIPE_SECRET_KEY")?.trim() ?? "";

const envWebhookSecret = () =>
  Deno.env.get("STRIPE_CLIENT_WEBHOOK_SECRET")?.trim() ?? "";

const envPublishableKey = () =>
  Deno.env.get("STRIPE_PUBLISHABLE_KEY")?.trim() ??
  Deno.env.get("VITE_STRIPE_PUBLISHABLE_KEY")?.trim() ??
  "";

const maskStripeKey = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (trimmed.length <= 12) return trimmed;
  return `${trimmed.slice(0, 8)}…${trimmed.slice(-4)}`;
};

const normalizeCredentialMode = (
  value: string | null | undefined,
): StripeCredentialMode =>
  value === "settings" ? "settings" : "server";

const credentialModeLabel = (mode: StripeCredentialMode) =>
  mode === "server" ? "Supabase server" : "Manual (Settings)";

const paymentStatusLabelFor = (status: ClientCardPaymentStatus) => {
  switch (status) {
    case "live":
      return "Card payments on";
    case "paused":
      return "Card payments paused";
    default:
      return "Not set up";
  }
};

export const resolveClientCardPaymentStatus = (
  secretConfigured: boolean,
  anyChannelEnabled: boolean,
): ClientCardPaymentStatus => {
  if (!secretConfigured) return "not_configured";
  return anyChannelEnabled ? "live" : "paused";
};

const loadOrgStripeRow = async (orgId: number): Promise<OrgStripeRow | null> => {
  const { data, error } = await supabaseAdmin
    .from("organizations")
    .select(
      "client_billing_mode, stripe_credential_mode, stripe_invoice_payments_enabled, stripe_payment_link_payments_enabled, stripe_proposal_payments_enabled, stripe_save_cards_default, stripe_publishable_key, stripe_secret_key_encrypted, stripe_client_webhook_secret_encrypted",
    )
    .eq("id", orgId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message ?? "Failed to load Stripe settings");
  }

  return data as OrgStripeRow | null;
};

const resolveDbSecretKey = async (orgId: number): Promise<string | null> => {
  const key = getPgcryptoKey();
  if (!key) return null;
  const { data, error } = await supabaseAdmin.rpc("get_org_stripe_secret_key", {
    p_org_id: orgId,
    p_key: key,
  });
  if (!error && typeof data === "string" && data.trim()) {
    return data.trim();
  }
  return null;
};

const resolveDbWebhookSecret = async (orgId: number): Promise<string | null> => {
  const key = getPgcryptoKey();
  if (!key) return null;
  const { data, error } = await supabaseAdmin.rpc(
    "get_org_stripe_webhook_secret",
    { p_org_id: orgId, p_key: key },
  );
  if (!error && typeof data === "string" && data.trim()) {
    return data.trim();
  }
  return null;
};

export async function resolveOrgStripeCredentialMode(
  orgId: number,
): Promise<StripeCredentialMode> {
  const row = await loadOrgStripeRow(orgId);
  return normalizeCredentialMode(row?.stripe_credential_mode);
}

export async function resolveOrgStripeSecretKey(orgId: number): Promise<string | null> {
  const mode = await resolveOrgStripeCredentialMode(orgId);
  if (mode === "settings") {
    return resolveDbSecretKey(orgId);
  }
  return envSecretKey() || null;
}

export async function resolveOrgStripeWebhookSecret(
  orgId?: number | null,
): Promise<string | null> {
  if (orgId != null) {
    const mode = await resolveOrgStripeCredentialMode(orgId);
    if (mode === "settings") {
      const fromDb = await resolveDbWebhookSecret(orgId);
      if (fromDb) return fromDb;
      return null;
    }
    const env = envWebhookSecret();
    if (env) return env;
    return null;
  }

  const { data: orgRow } = await supabaseAdmin
    .from("organizations")
    .select("id, stripe_credential_mode")
    .not("stripe_client_webhook_secret_encrypted", "is", null)
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (orgRow?.id != null) {
    const mode = normalizeCredentialMode(orgRow.stripe_credential_mode);
    if (mode === "settings") {
      const fromDb = await resolveDbWebhookSecret(orgRow.id);
      if (fromDb) return fromDb;
    }
  }

  return envWebhookSecret() || null;
}

export async function resolveOrgStripePublishableKey(
  orgId: number,
): Promise<string | null> {
  const row = await loadOrgStripeRow(orgId);
  const mode = normalizeCredentialMode(row?.stripe_credential_mode);
  const fromDb = row?.stripe_publishable_key?.trim();
  if (mode === "settings") {
    return fromDb || null;
  }
  return fromDb || envPublishableKey() || null;
}

const credentialsConfiguredForMode = (
  mode: StripeCredentialMode,
  hasDbSecret: boolean,
  hasEnvSecret: boolean,
) => (mode === "settings" ? hasDbSecret : hasEnvSecret);

export async function isOrgInvoiceCardPaymentsEnabled(
  orgId: number,
): Promise<boolean> {
  const row = await loadOrgStripeRow(orgId);
  if (!row?.stripe_invoice_payments_enabled) return false;
  const secret = await resolveOrgStripeSecretKey(orgId);
  return Boolean(secret);
}

export async function isOrgPaymentLinkCardPaymentsEnabled(
  orgId: number,
): Promise<boolean> {
  // Payment links and invoice checkout share one Stripe toggle.
  return isOrgInvoiceCardPaymentsEnabled(orgId);
}

/** Client checkout on invoice pages and short payment links. */
export async function isOrgClientInvoiceCheckoutEnabled(
  orgId: number,
): Promise<boolean> {
  return isOrgInvoiceCardPaymentsEnabled(orgId);
}

export async function isOrgProposalCardPaymentsEnabled(
  orgId: number,
): Promise<boolean> {
  const row = await loadOrgStripeRow(orgId);
  if (!row?.stripe_proposal_payments_enabled) return false;
  const secret = await resolveOrgStripeSecretKey(orgId);
  return Boolean(secret);
}

/** @deprecated Use isOrgClientInvoiceCheckoutEnabled */
export async function isOrgClientStripePaymentsEnabled(
  orgId: number,
): Promise<boolean> {
  return isOrgClientInvoiceCheckoutEnabled(orgId);
}

export async function getStripeClientSettingsPublic(
  orgId: number,
): Promise<StripeClientSettingsPublic> {
  const data = await loadOrgStripeRow(orgId);
  const credentialMode = normalizeCredentialMode(data?.stripe_credential_mode);

  const hasDbSecret = Boolean(data?.stripe_secret_key_encrypted?.trim());
  const hasDbWebhook = Boolean(
    data?.stripe_client_webhook_secret_encrypted?.trim(),
  );
  const hasEnvSecret = Boolean(envSecretKey());
  const hasEnvWebhook = Boolean(envWebhookSecret());

  const secretConfigured = credentialsConfiguredForMode(
    credentialMode,
    hasDbSecret,
    hasEnvSecret,
  );
  const webhookConfigured =
    credentialMode === "settings" ? hasDbWebhook : hasEnvWebhook || hasDbWebhook;

  const publishable =
    credentialMode === "settings"
      ? data?.stripe_publishable_key?.trim() || null
      : data?.stripe_publishable_key?.trim() || envPublishableKey() || null;

  const invoicePaymentsEnabled = data?.stripe_invoice_payments_enabled !== false;
  const paymentLinkPaymentsEnabled = invoicePaymentsEnabled;
  const proposalPaymentsEnabled = Boolean(
    data?.stripe_proposal_payments_enabled,
  );
  const saveCardsDefault = data?.stripe_save_cards_default !== false;
  const anyChannelEnabled =
    invoicePaymentsEnabled ||
    paymentLinkPaymentsEnabled ||
    proposalPaymentsEnabled;

  const configured = secretConfigured && Boolean(publishable || secretConfigured);
  const paymentStatus = resolveClientCardPaymentStatus(
    secretConfigured,
    anyChannelEnabled,
  );

  const activeCredentialSource: StripeClientSettingsPublic["credential_source"] =
    !secretConfigured
      ? "none"
      : credentialMode === "settings"
        ? "database"
        : "environment";

  return {
    org_id: orgId,
    stripe_credential_mode: credentialMode,
    credential_mode_label: credentialModeLabel(credentialMode),
    invoice_payments_enabled: invoicePaymentsEnabled,
    payment_link_payments_enabled: paymentLinkPaymentsEnabled,
    proposal_payments_enabled: proposalPaymentsEnabled,
    save_cards_default: saveCardsDefault,
    configured,
    payment_status: paymentStatus,
    payment_status_label: paymentStatusLabelFor(paymentStatus),
    credential_source: activeCredentialSource,
    connection_label:
      !secretConfigured
        ? "Not configured"
        : credentialMode === "server"
          ? "Connected (Supabase server)"
          : "Connected (Settings)",
    server_keys_configured: hasEnvSecret,
    settings_keys_configured: hasDbSecret,
    stripe_publishable_key:
      credentialMode === "settings" ? publishable : null,
    publishable_key_preview: maskStripeKey(publishable),
    publishable_key_configured: Boolean(publishable),
    secret_key_configured: secretConfigured,
    webhook_secret_configured: webhookConfigured,
    has_secret_key: secretConfigured,
    has_webhook_secret: webhookConfigured,
    webhook_url: getClientWebhookUrl(),
  };
}

export async function upsertStripeClientSettings(
  orgId: number,
  body: {
    stripe_credential_mode?: StripeCredentialMode;
    invoice_payments_enabled?: boolean;
    payment_link_payments_enabled?: boolean;
    proposal_payments_enabled?: boolean;
    save_cards_default?: boolean;
    stripe_publishable_key?: string | null;
    stripe_secret_key?: string | null;
    stripe_webhook_secret?: string | null;
  },
) {
  const pgcryptoKey = getPgcryptoKey();
  const update: Record<string, string | boolean | null> = {};

  if (body.stripe_credential_mode !== undefined) {
    update.stripe_credential_mode = body.stripe_credential_mode;
  }

  if (body.invoice_payments_enabled !== undefined) {
    update.stripe_invoice_payments_enabled = body.invoice_payments_enabled;
    update.stripe_payment_link_payments_enabled = body.invoice_payments_enabled;
  }

  if (body.payment_link_payments_enabled !== undefined) {
    update.stripe_invoice_payments_enabled = body.payment_link_payments_enabled;
    update.stripe_payment_link_payments_enabled =
      body.payment_link_payments_enabled;
  }

  if (body.proposal_payments_enabled !== undefined) {
    update.stripe_proposal_payments_enabled = body.proposal_payments_enabled;
    update.client_billing_mode = body.proposal_payments_enabled
      ? "stripe"
      : "manual";
  }

  if (body.save_cards_default !== undefined) {
    update.stripe_save_cards_default = body.save_cards_default;
  }

  if (body.stripe_publishable_key !== undefined) {
    const publishable = body.stripe_publishable_key?.trim();
    if (publishable) {
      update.stripe_publishable_key = publishable;
    } else if (body.stripe_publishable_key === null) {
      update.stripe_publishable_key = null;
    }
  }

  if (Object.keys(update).length > 0) {
    const { error } = await supabaseAdmin
      .from("organizations")
      .update(update)
      .eq("id", orgId);
    if (error) {
      throw new Error(error.message ?? "Could not save Stripe settings");
    }
  }

  const secret = body.stripe_secret_key?.trim();
  if (secret) {
    if (!pgcryptoKey) {
      throw new Error("PGCRYPTO_KEY is not configured on the server");
    }
    const { error } = await supabaseAdmin.rpc("set_org_stripe_secret_key", {
      p_org_id: orgId,
      p_secret: secret,
      p_key: pgcryptoKey,
    });
    if (error) {
      throw new Error(error.message ?? "Could not save Stripe secret key");
    }
  }

  const webhookSecret = body.stripe_webhook_secret?.trim();
  if (webhookSecret) {
    if (!pgcryptoKey) {
      throw new Error("PGCRYPTO_KEY is not configured on the server");
    }
    const { error } = await supabaseAdmin.rpc("set_org_stripe_webhook_secret", {
      p_org_id: orgId,
      p_secret: webhookSecret,
      p_key: pgcryptoKey,
    });
    if (error) {
      throw new Error(error.message ?? "Could not save webhook secret");
    }
  }

  return getStripeClientSettingsPublic(orgId);
}
