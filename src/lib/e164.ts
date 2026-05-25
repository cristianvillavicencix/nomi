/** E.164 phone format: + followed by 1–15 digits (ITU-T). */
export const E164_PATTERN = /^\+[1-9]\d{1,14}$/;

export function isValidE164(phone: string): boolean {
  return E164_PATTERN.test(phone.trim());
}
