export const generateShortCode = (length = 7): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
};

export const generateUniqueShortCode = async (
  exists: (code: string) => Promise<boolean>,
  maxAttempts = 8,
): Promise<string> => {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const code = generateShortCode();
    if (!(await exists(code))) return code;
  }
  throw new Error("Could not generate unique short code");
};
