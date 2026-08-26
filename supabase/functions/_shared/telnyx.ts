import { assertSmsBodyWithinLimit } from "./smsMessageLimits.ts";

const getTelnyxSmsStatusCallbackUrl = () => {
  const explicit = Deno.env.get("TELNYX_SMS_STATUS_CALLBACK_URL")?.trim();
  if (explicit) return explicit;
  const base = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  if (!base) return null;
  return `${base}/functions/v1/telnyx_sms_status`;
};

export type TelnyxSendResult = {
  id?: string;
  status?: string;
};

export async function sendTelnyxSms(params: {
  apiKey: string;
  from: string;
  to: string;
  body: string;
  mediaUrls?: string[];
  messagingProfileId?: string | null;
  statusCallback?: string | null;
}): Promise<TelnyxSendResult> {
  const body = params.body.trim() || " ";
  if (body !== " ") {
    assertSmsBodyWithinLimit(body);
  }

  const from = params.from.trim();
  if (!from) {
    throw new Error("Telnyx From number is required");
  }

  const payload: Record<string, unknown> = {
    from,
    to: params.to.trim(),
    text: body,
    type: "SMS",
  };

  const profileId = params.messagingProfileId?.trim();
  if (profileId) {
    payload.messaging_profile_id = profileId;
  }

  const media = (params.mediaUrls ?? [])
    .map((url) => url.trim())
    .filter(Boolean);
  if (media.length > 0) {
    payload.media_urls = media;
  }

  const webhookUrl = params.statusCallback ?? getTelnyxSmsStatusCallbackUrl();
  if (webhookUrl) {
    payload.webhook_url = webhookUrl;
    payload.webhook_failover_url = webhookUrl;
  }

  const response = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey.trim()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const json = (await response.json().catch(() => ({}))) as {
    data?: { id?: string; to?: Array<{ status?: string }> };
    errors?: Array<{ detail?: string; title?: string }>;
  };

  if (!response.ok) {
    const message =
      json.errors?.[0]?.detail ||
      json.errors?.[0]?.title ||
      "Telnyx rejected the SMS request";
    throw new Error(message);
  }

  return {
    id: json.data?.id,
    status: json.data?.to?.[0]?.status ?? "queued",
  };
}

/** Map Telnyx delivery status → conversation_messages.sms_delivery_status. */
export function normalizeTelnyxDeliveryStatus(
  raw: string | undefined | null,
): string | null {
  const value = raw?.trim().toLowerCase();
  if (!value) return null;
  switch (value) {
    case "queued":
    case "sending":
    case "sent":
    case "delivered":
    case "sending_failed":
    case "delivery_failed":
    case "delivery_unconfirmed":
      if (value === "sending_failed" || value === "delivery_failed") {
        return "failed";
      }
      if (value === "delivery_unconfirmed") return "undelivered";
      return value;
    case "webhook_delivered":
      return "delivered";
    default:
      return null;
  }
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Verify Telnyx Ed25519 webhook signature when TELNYX_PUBLIC_KEY is set.
 * Public key is base64 from Mission Control → Account → Keys & Credentials.
 */
export async function validateTelnyxWebhookSignature(
  req: Request,
  rawBody: string,
): Promise<boolean> {
  const publicKeyB64 = Deno.env.get("TELNYX_PUBLIC_KEY")?.trim();
  if (!publicKeyB64) {
    // Portal setup may lag; still accept when phone-number org match succeeds upstream.
    return true;
  }

  const signature = req.headers.get("telnyx-signature-ed25519");
  const timestamp = req.headers.get("telnyx-timestamp");
  if (!signature || !timestamp) return false;

  try {
    const keyBytes = base64UrlToBytes(publicKeyB64);
    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "Ed25519", namedCurve: "Ed25519" },
      false,
      ["verify"],
    );
    const payload = new TextEncoder().encode(`${timestamp}|${rawBody}`);
    const sigBytes = base64UrlToBytes(signature);
    return await crypto.subtle.verify("Ed25519", key, sigBytes, payload);
  } catch (error) {
    console.warn("validateTelnyxWebhookSignature failed", error);
    return false;
  }
}

export async function createTelnyxTelephonyCredentialToken(params: {
  apiKey: string;
  telephonyCredentialId: string;
}): Promise<string> {
  const id = params.telephonyCredentialId.trim();
  const response = await fetch(
    `https://api.telnyx.com/v2/telephony_credentials/${encodeURIComponent(id)}/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey.trim()}`,
        Accept: "application/json",
      },
    },
  );
  const raw = (await response.text()).trim();
  if (!response.ok) {
    let detail = "Failed to create Telnyx WebRTC token";
    try {
      const json = JSON.parse(raw) as { errors?: Array<{ detail?: string }> };
      detail = json.errors?.[0]?.detail || detail;
    } catch {
      // keep default
    }
    throw new Error(detail);
  }
  // Telnyx often returns a bare JWT string (not JSON).
  if (raw.split(".").length >= 3 && !raw.startsWith("{")) {
    return raw;
  }
  const json = JSON.parse(raw) as {
    data?: string | { token?: string };
  };
  if (typeof json.data === "string" && json.data.trim()) {
    return json.data.trim();
  }
  if (
    json.data &&
    typeof json.data === "object" &&
    typeof json.data.token === "string"
  ) {
    return json.data.token.trim();
  }
  throw new Error("Telnyx WebRTC token missing in response");
}
