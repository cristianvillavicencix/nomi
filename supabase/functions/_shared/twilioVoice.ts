export const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

export const mapTwilioVoiceStatus = (status: string) => {
  const normalized = status.trim().toLowerCase();
  switch (normalized) {
    case "queued":
    case "initiated":
      return "queued";
    case "ringing":
      return "ringing";
    case "in-progress":
    case "answered":
      return "in-progress";
    case "completed":
      return "completed";
    case "busy":
      return "busy";
    case "no-answer":
      return "no-answer";
    case "failed":
      return "failed";
    case "canceled":
    case "cancelled":
      return "canceled";
    default:
      return normalized || "queued";
  }
};

export const buildTwimlSayAndHangup = (message: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${escapeXml(message)}</Say>
  <Hangup/>
</Response>`;

export const buildOutboundDialTwiml = (params: {
  to: string;
  callerId: string;
  statusCallbackUrl: string;
  record?: boolean;
}) => {
  const recordAttr = params.record
    ? ' record="record-from-answer-dual"'
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${escapeXml(params.callerId)}" answerOnBridge="true"${recordAttr} statusCallback="${escapeXml(params.statusCallbackUrl)}" statusCallbackMethod="POST" statusCallbackEvent="initiated ringing answered completed">
    <Number>${escapeXml(params.to)}</Number>
  </Dial>
</Response>`;
};

/** Twilio Client may send the dialed number in To, Called, or a custom param. */
export const resolveOutboundDestination = (
  params: Record<string, string>,
): string | null => {
  const candidates = [
    params.To,
    params.to,
    params.Called,
    params.called,
    params.destination,
  ];
  for (const raw of candidates) {
    const trimmed = raw?.trim();
    if (!trimmed || trimmed.startsWith("client:")) continue;
    return trimmed;
  }
  return null;
};

export const buildInboundDialClientsTwiml = (params: {
  clientIdentities: string[];
  statusCallbackUrl: string;
}) => {
  if (params.clientIdentities.length === 0) {
    return buildTwimlSayAndHangup(
      "No one is available to take your call right now. Please try again later.",
    );
  }

  const clients = params.clientIdentities
    .map(
      (identity) =>
        `    <Client statusCallback="${escapeXml(params.statusCallbackUrl)}" statusCallbackMethod="POST" statusCallbackEvent="initiated ringing answered completed">${escapeXml(identity)}</Client>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial answerOnBridge="true" timeout="30" statusCallback="${escapeXml(params.statusCallbackUrl)}" statusCallbackMethod="POST" statusCallbackEvent="initiated ringing answered completed">
${clients}
  </Dial>
</Response>`;
};

export const parseTwilioFormBody = async (req: Request) => {
  const form = await req.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") {
      params[key] = value;
    }
  }
  return params;
};
