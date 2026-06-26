export const PORTAL_IDLE_MS = 30 * 60 * 1000;

export type StoredPortalAuthSession = {
  sensitive_session: string;
  expires_at: string;
  last_activity_at: number;
};

export const portalAuthStorageKey = (portalToken: string) =>
  `lbs.client_portal.auth.${portalToken.slice(0, 12)}`;

export const readPortalAuthSession = (
  portalToken: string,
): StoredPortalAuthSession | null => {
  if (!portalToken.trim()) return null;
  try {
    const raw = sessionStorage.getItem(portalAuthStorageKey(portalToken));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPortalAuthSession;
    if (!parsed.sensitive_session || !parsed.expires_at) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const isPortalAuthSessionActive = (
  session: StoredPortalAuthSession | null,
  now = Date.now(),
): boolean => {
  if (!session) return false;
  if (new Date(session.expires_at).getTime() <= now) return false;
  if (now - session.last_activity_at > PORTAL_IDLE_MS) return false;
  return true;
};

export const writePortalAuthSession = (
  portalToken: string,
  session: Omit<StoredPortalAuthSession, "last_activity_at">,
) => {
  const stored: StoredPortalAuthSession = {
    ...session,
    last_activity_at: Date.now(),
  };
  sessionStorage.setItem(
    portalAuthStorageKey(portalToken),
    JSON.stringify(stored),
  );
  return stored;
};

export const touchPortalAuthSession = (
  portalToken: string,
  session: StoredPortalAuthSession,
) => {
  const next = { ...session, last_activity_at: Date.now() };
  sessionStorage.setItem(
    portalAuthStorageKey(portalToken),
    JSON.stringify(next),
  );
  return next;
};

export const clearPortalAuthSession = (portalToken: string) => {
  sessionStorage.removeItem(portalAuthStorageKey(portalToken));
};
