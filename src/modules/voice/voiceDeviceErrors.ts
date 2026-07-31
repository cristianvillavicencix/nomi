/** Twilio Voice SDK error codes we surface with clearer copy. */
const TWILIO_VOICE_ERROR_HINTS: Record<number, string> = {
  31003:
    "Could not connect the call. Check your microphone permission and network.",
  31005:
    "Call connection lost. Check your internet connection and try again.",
  31008: "Microphone access is required to place or receive calls.",
  31009: "Call was cancelled before it connected.",
  31201: "Voice is not available right now. Try again in a moment.",
  31208: "Could not reach Twilio Voice. Check your network or VPN.",
};

export const extractTwilioVoiceErrorCode = (
  error: { code?: number; message?: string } | null | undefined,
): number | undefined => {
  if (error?.code != null && Number.isFinite(error.code)) {
    return Number(error.code);
  }
  const match = error?.message?.match(/\((\d{5})\)/);
  return match ? Number(match[1]) : undefined;
};

export const formatVoiceDeviceError = (
  error: { code?: number; message?: string } | null | undefined,
): string => {
  const code = extractTwilioVoiceErrorCode(error);
  if (code != null && TWILIO_VOICE_ERROR_HINTS[code]) {
    return TWILIO_VOICE_ERROR_HINTS[code];
  }
  const message = error?.message?.trim();
  return message || "Voice connection error";
};

/** Transient signaling drops while idle; SDK reconnects automatically. */
export const isTransientVoiceDeviceError = (
  error: { code?: number; message?: string } | null | undefined,
): boolean => {
  const code = extractTwilioVoiceErrorCode(error);
  return code === 31005 || code === 31208;
};
