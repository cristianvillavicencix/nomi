const encoder = new TextEncoder();

const base64UrlEncode = (value: string | Uint8Array) => {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

const signHs256 = async (secret: string, data: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return base64UrlEncode(new Uint8Array(signature));
};

export const createTwilioVoiceAccessToken = async (params: {
  accountSid: string;
  apiKeySid: string;
  apiKeySecret: string;
  identity: string;
  twimlAppSid: string;
  ttlSeconds?: number;
}) => {
  const now = Math.floor(Date.now() / 1000);
  const ttl = params.ttlSeconds ?? 3600;
  const header = {
    typ: "JWT",
    alg: "HS256",
    cty: "twilio-fpa;v=1",
  };
  const payload = {
    jti: `${params.apiKeySid}-${now}`,
    iss: params.apiKeySid,
    sub: params.accountSid,
    iat: now,
    nbf: now,
    exp: now + ttl,
    grants: {
      identity: params.identity,
      voice: {
        incoming: { allow: true },
        outgoing: {
          application_sid: params.twimlAppSid,
        },
      },
    },
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = await signHs256(params.apiKeySecret, signingInput);
  return `${signingInput}.${signature}`;
};
