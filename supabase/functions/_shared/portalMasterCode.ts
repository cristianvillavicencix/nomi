/** Staff bypass for portal OTP (set CLIENT_PORTAL_MASTER_CODE on hosted Edge secrets). */
export const getPortalMasterCode = () =>
  Deno.env.get("CLIENT_PORTAL_MASTER_CODE")?.trim() ?? "";

export const isPortalMasterCode = (code: string) => {
  const master = getPortalMasterCode();
  const normalized = code.trim();
  if (!master || !normalized) return false;
  return normalized === master;
};
