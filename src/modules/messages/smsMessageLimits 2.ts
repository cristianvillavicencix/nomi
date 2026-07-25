/** Twilio hard limit for a single SMS request (concatenated segments). */
export const SMS_MAX_BODY_CHARS = 1600;

const GSM_SINGLE_SEGMENT = 160;
const GSM_MULTI_SEGMENT = 153;
const UCS2_SINGLE_SEGMENT = 70;
const UCS2_MULTI_SEGMENT = 67;

const usesUcs2Encoding = (text: string) => {
  for (const char of text) {
    if ((char.codePointAt(0) ?? 0) > 127) return true;
  }
  return false;
};

export const estimateSmsSegments = (text: string) => {
  const length = text.length;
  if (length === 0) return 0;

  if (usesUcs2Encoding(text)) {
    if (length <= UCS2_SINGLE_SEGMENT) return 1;
    return Math.ceil(length / UCS2_MULTI_SEGMENT);
  }

  if (length <= GSM_SINGLE_SEGMENT) return 1;
  return Math.ceil(length / GSM_MULTI_SEGMENT);
};

export const isSmsBodyWithinLimit = (body: string) =>
  body.length <= SMS_MAX_BODY_CHARS;

export const assertSmsBodyWithinLimit = (body: string) => {
  if (isSmsBodyWithinLimit(body)) return;

  throw new Error(
    `SMS is too long (${body.length.toLocaleString()} characters). Maximum is ${SMS_MAX_BODY_CHARS.toLocaleString()} characters.`,
  );
};

export const formatSmsLengthSummary = (body: string) => {
  const length = body.length;
  const segments = estimateSmsSegments(body);
  const segmentLabel = segments === 1 ? "1 segment" : `${segments} segments`;
  return `${length.toLocaleString()} / ${SMS_MAX_BODY_CHARS.toLocaleString()} · ${segmentLabel}`;
};

export const isSmsLengthOverLimit = (body: string) =>
  body.length > SMS_MAX_BODY_CHARS;

export const isSmsLengthWarning = (body: string) =>
  body.length > GSM_SINGLE_SEGMENT && body.length <= SMS_MAX_BODY_CHARS;
