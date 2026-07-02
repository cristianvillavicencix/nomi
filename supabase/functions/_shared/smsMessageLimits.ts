/** Twilio hard limit for a single SMS request (concatenated segments). */
export const SMS_MAX_BODY_CHARS = 1600;

export const assertSmsBodyWithinLimit = (body: string) => {
  if (body.length <= SMS_MAX_BODY_CHARS) return;

  throw new Error(
    `SMS is too long (${body.length} characters). Maximum is ${SMS_MAX_BODY_CHARS} characters.`,
  );
};
