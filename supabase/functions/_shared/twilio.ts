export async function sendTwilioSms(params: {
  accountSid: string;
  authToken: string;
  from: string;
  to: string;
  body: string;
  mediaUrls?: string[];
}) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${params.accountSid}/Messages.json`;
  const credentials = btoa(`${params.accountSid}:${params.authToken}`);

  const form = new URLSearchParams({
    To: params.to,
    From: params.from,
    Body: params.body.trim() || " ",
  });

  for (const mediaUrl of params.mediaUrls ?? []) {
    if (mediaUrl.trim()) {
      form.append("MediaUrl", mediaUrl.trim());
    }
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof json?.message === "string"
        ? json.message
        : "Twilio rejected the SMS request";
    throw new Error(message);
  }

  return json as { sid?: string; status?: string };
}

export async function validateTwilioSignature(
  authToken: string,
  signature: string | null,
  url: string,
  params: Record<string, string>,
) {
  if (!signature) return false;

  const sortedKeys = Object.keys(params).sort();
  let payload = url;
  for (const key of sortedKeys) {
    payload += key + params[key];
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );

  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );

  const computed = btoa(String.fromCharCode(...new Uint8Array(digest)));
  return computed === signature;
}

export async function validateTwilioSignatureForRequest(
  authToken: string,
  signature: string | null,
  req: Request,
  params: Record<string, string>,
) {
  if (!signature) return false;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  const requestUrl = new URL(req.url);
  const candidates = [
    Deno.env.get("TWILIO_WEBHOOK_URL")?.trim(),
    supabaseUrl ? `${supabaseUrl}/functions/v1/twilio_inbound_sms` : null,
    `${requestUrl.origin}${requestUrl.pathname}`,
    req.url.split("?")[0],
  ].filter((value): value is string => Boolean(value));

  for (const url of [...new Set(candidates)]) {
    if (await validateTwilioSignature(authToken, signature, url, params)) {
      return true;
    }
  }

  console.error("twilio_inbound_sms invalid signature", {
    triedUrls: [...new Set(candidates)],
  });
  return false;
}
