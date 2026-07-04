import { supabaseAdmin } from "./supabaseAdmin.ts";

export type ClientCardPaymentStatus = "live" | "paused" | "not_configured";

export type StripeClientSettingsPublic = {
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

const connectionLabelFor = (
  source: StripeClientSettingsPublic["credential_source"],
  configured: boolean,
) => {
  if (!configured) return "Not configured";
  if (source === "environment") return "Connected (server)";
  if (source === "database") return "Connected (Settings)";
  return "Not configured";
};

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
  clientPaymentsEnabled: boolean,
): ClientCardPaymentStatus => {
  if (!secretConfigured) return "not_configured";
  return clientPaymentsEnabled ? "live" : "paused";
};

export async function resolveOrgStripeSecretKey(orgId: number): Promise<string | null> {
  const key = getPgcryptoKey();
  if (key) {
    const { data, error } = await supabaseAdmin.rpc("get_org_stripe_secret_key", {
      p_org_id: orgId,
      p_key: key,
    });
    if (!error && typeof data === "string" && data.trim()) {
      return data.trim();
    }
  }

  const env = envSecretKey();
  return env || null;
}

export async function resolveOrgStripeWebhookSecret(
  orgId?: number | null,
): Promise<string | null> {
  if (orgId != null) {
    const key = getPgcryptoKey();
    if (key) {
      const { data, error } = await supabaseAdmin.rpc(
        "get_org_stripe_webhook_secret",
        { p_org_id: orgId, p_key: key },
      );
      if (!error && typeof data === "string" && data.trim()) {
        return data.trim();
      }
    }
  }

  const { data: orgRow } = await supabaseAdmin
    .from("organizations")
    .select("id")
    .not("stripe_client_webhook_secret_encrypted", "is", null)
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (orgRow?.id != null) {
    const key = getPgcryptoKey();
    if (key) {
      const { data } = await supabaseAdmin.rpc("get_org_stripe_webhook_secret", {
        p_org_id: orgRow.id,
        p_key: key,
      });
      if (typeof data === "string" && data.trim()) {
        return data.trim();
      }
    }
  }

  const env = envWebhookSecret();
  return env || null;
}

export async function resolveOrgStripePublishableKey(
  orgId: number,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("organizations")
    .select("stripe_publishable_key, client_billing_mode")
    .eq("id", orgId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message ?? "Failed to load Stripe settings");
  }

  const fromDb = data?.stripe_publishable_key?.trim();
  if (fromDb) return fromDb;

  const env = envPublishableKey();
  return env || null;
}

export async function isOrgClientStripePaymentsEnabled(
  orgId: number,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("organizations")
    .select("client_billing_mode, stripe_secret_key_encrypted")
    .eq("id", orgId)
    .maybeSingle();

  if (error || !data) return false;
  if (data.client_billing_mode !== "stripe") return false;

  const secret = await resolveOrgStripeSecretKey(orgId);
  return Boolean(secret);
}

export async function getStripeClientSettingsPublic(
  orgId: number,
): Promise<StripeClientSettingsPublic> {
  const { data, error } = await supabaseAdmin
    .from("organizations")
    .select(
      "id, client_billing_mode, stripe_publishable_key, stripe_secret_key_encrypted, stripe_client_webhook_secret_encrypted",
    )
    .eq("id", orgId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message ?? "Failed to load Stripe settings");
  }

  const hasDbSecret = Boolean(data?.stripe_secret_key_encrypted?.trim());
  const hasDbWebhook = Boolean(
    data?.stripe_client_webhook_secret_encrypted?.trim(),
  );
  const hasEnvSecret = Boolean(envSecretKey());
  const hasEnvWebhook = Boolean(envWebhookSecret());

  let credentialSource: StripeClientSettingsPublic["credential_source"] = "none";
  if (hasDbSecret) {
    credentialSource = "database";
  } else if (hasEnvSecret) {
    credentialSource = "environment";
  }

  const publishable =
    data?.stripe_publishable_key?.trim() || envPublishableKey() || null;

  const configured =
    credentialSource !== "none" &&
    Boolean(publishable || hasDbSecret || hasEnvSecret);

  const secretConfigured = hasDbSecret || hasEnvSecret;
  const webhookConfigured = hasDbWebhook || hasEnvWebhook;
  const clientPaymentsEnabled = data?.client_billing_mode === "stripe";
  const paymentStatus = resolveClientCardPaymentStatus(
    secretConfigured,
    clientPaymentsEnabled,
  );

  return {
    org_id: orgId,
    client_payments_enabled: clientPaymentsEnabled,
    configured,
    payment_status: paymentStatus,
    payment_status_label: paymentStatusLabelFor(paymentStatus),
    credential_source: credentialSource,
    connection_label: connectionLabelFor(credentialSource, configured),
    stripe_publishable_key:
      credentialSource === "database" ? publishable : null,
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
    client_payments_enabled?: boolean;
    stripe_publishable_key?: string | null;
    stripe_secret_key?: string | null;
    keepExistingSecretKey?: boolean;
    stripe_webhook_secret?: string | null;
    keepExistingWebhookSecret?: boolean;
  },
) {
  const pgcryptoKey = getPgcryptoKey();
  const update: Record<string, string | boolean | null> = {};

  if (body.client_payments_enabled !== undefined) {
    update.client_billing_mode = body.client_payments_enabled ? "stripe" : "manual";
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
