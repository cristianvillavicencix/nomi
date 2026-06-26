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
  <Dial callerId="${escapeXml(params.callerId)}" answerOnBridge="true"${recordAttr} action="${escapeXml(params.statusCallbackUrl)}" method="POST">
    <Number statusCallback="${escapeXml(params.statusCallbackUrl)}" statusCallbackMethod="POST" statusCallbackEvent="initiated ringing answered completed">${escapeXml(params.to)}</Number>
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
